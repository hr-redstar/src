﻿// handler/送迎パネル/メイン.js
const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { sendOrUpdatePanel } = require('../共通/パネル送信');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const { buildDriverPanelMessage, buildRideListPanelMessage } = require('./埋め込み作成');
const { getQueue } = require('../../utils/配車/待機列マネージャ');

const onAction = require('./アクション/出勤');
const offAction = require('./アクション/退勤');
const locationAction = require('./アクション/現在地更新');

async function updateDriverPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.driverPanel;

  if (!panel || !panel.channelId) return;

  const channel =
    guild.channels.cache.get(panel.channelId) ||
    (await guild.channels.fetch(panel.channelId).catch(() => null));
  if (!channel) return;

  // 待機中の送迎者数をカウント
  const queue = await getQueue(guild.id);
  const waitingCount = queue ? queue.length : 0;

  // 送迎中（実車中）の送迎車数をカウント
  const activeDispatchDir = paths.activeDispatchDir(guild.id);
  const activeFiles = await store.listKeys(activeDispatchDir).catch(() => []);
  // ファイルの中身を読んで、進行中の送迎に携わっているdriverIdを数える
  const activeDispatches = await Promise.all(
    activeFiles
      .filter((f) => f.endsWith('.json'))
      .map((f) => store.readJson(f).catch(() => null))
  );

  const { RideStatus } = require('../../utils/constants');
  const validWorkingDispatches = activeDispatches.filter((d) => {
    if (!d || !d.driverId) return false;
    // 完了・キャンセル・強制終了等は除外
    if (d.status === RideStatus.COMPLETED || d.status === 'completed' || d.status === 'COMPLETED') return false;
    if (d.status === RideStatus.CANCELLED || d.status === 'cancelled' || d.status === 'CANCELLED') return false;
    if (d.status === 'finished' || d.status === 'FINISHED' || d.status === 'ENDED' || d.status === 'FORCED') return false;
    if (d.completedAt) return false;
    return true;
  });

  const workingDriverIds = [...new Set(validWorkingDispatches.map((d) => d.driverId))];
  const workingCount = workingDriverIds.length;

  const activeCount = waitingCount + workingCount;

  logger.debug(
    `[DriverPanel] Active Drivers: ${activeCount} (Waiting: ${waitingCount}, Working: ${workingCount})`,
    { guildId: guild.id }
  );

  const newMessageId = await sendOrUpdatePanel({
    channel,
    messageId: panel.messageId,
    buildMessage: () => buildDriverPanelMessage(guild, activeCount, client),
    suppressFallback: true, // 自動更新時は勝手に再送しない
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    config.panels.driverPanel.messageId = newMessageId;
    await saveConfig(guild.id, config);
  }
}

async function updateRideListPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.rideListPanel;

  if (!panel || !panel.channelId) return;

  const channel =
    guild.channels.cache.get(panel.channelId) ||
    (await guild.channels.fetch(panel.channelId).catch(() => null));
  if (!channel) return;

  const newMessageId = await sendOrUpdatePanel({
    channel,
    messageId: panel.messageId,
    buildMessage: () => buildRideListPanelMessage(guild, client),
    suppressFallback: true, // 自動更新時は勝手に再送しない
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    config.panels.rideListPanel.messageId = newMessageId;
    await saveConfig(guild.id, config);
  }
}

/**
 * 関連する送迎パネル群をまとめて更新する
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} client
 */
function updateRelevantPanels(guild, client) {
  if (!guild) return; // DM等ではギルド情報がないためスキップ
  // 更新処理は非同期で実行し、完了を待たない（fire and forget）
  Promise.all([updateDriverPanel(guild, client), updateRideListPanel(guild, client)]).catch((err) =>
    logger.error('パネルの更新に失敗しました。', { error: err, guildId: guild.id })
  );
}

// ===== Handler =====
async function execute(interaction, client, parsed) {
  const action = parsed?.action;

  // アクションの実行
  if (action === 'on') {
    await onAction(interaction, client, parsed);
  } else if (action === 'off') {
    await offAction(interaction, client, parsed);
  } else if (action === 'location') {
    // 現在地更新処理（完了後にパネル更新が必要な場合があるため、更新関数を渡す）
    return locationAction(interaction, client, parsed, () => updateRelevantPanels(interaction.guild, client));
  } else if (action === 'return_queue') {
    const sub = parsed.params?.sub;
    if (sub === 'submit') {
      // モーダル送信後の処理
      await handleReturnQueueSubmit(interaction, client, parsed);
    } else if (sub === 'use_original') {
      // 出勤時の場所で復帰
      await handleReturnQueueUseOriginal(interaction, client, parsed);
    } else if (sub === 'use_last') {
      // 直前の送迎場所で復帰
      await handleReturnQueueUseLast(interaction, client, parsed);
    } else if (sub === 'use_other') {
      // その他（手動入力）→モーダル表示
      await showReturnQueueModal(interaction, parsed);
    } else {
      // サブアクションなし→場所選択画面を表示
      await showReturnQueueLocationSelector(interaction, parsed);
    }
  } else {
    // 不明なアクションの場合は何もしない
    return;
  }

  // 出勤・退勤処理後にパネルを更新
  updateRelevantPanels(interaction.guild, client);
}

/**
 * 待機列復帰時の場所選択画面を表示
 */
async function showReturnQueueLocationSelector(interaction, parsed) {
  const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
  const { loadDriver } = require('../../utils/driversStore');
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');

  const guildId = interaction.guildId || parsed?.params?.gid;
  const userId = interaction.user.id;

  // 送迎者データを取得
  const driverData = await loadDriver(guildId, userId).catch(() => null);
  if (!driverData) {
    return interaction.reply({
      content: '⚠️ 送迎者データが見つかりません。通常の出勤ボタンから出勤してください。',
      flags: 64
    });
  }

  const actualData = driverData.current || driverData;
  const originalLocation = actualData.stopPlace || '不明';
  const lastDropOff = driverData.lastDropOffLocation || null;

  // Embed作成
  const embed = buildPanelEmbed({
    title: '🚗 待機列に復帰',
    description: '待機場所を選択してください：',
    color: 0x3498db,
    client: interaction.client,
    fields: [
      { name: '📍 出勤時の場所', value: originalLocation, inline: false },
      ...(lastDropOff ? [{ name: '📍 直前の送迎場所', value: lastDropOff, inline: false }] : []),
    ]
  });

  // ボタン作成 (ギルドIDを伝播させる)
  const gidParam = guildId ? `&gid=${guildId}` : '';
  const buttons = [
    new ButtonBuilder()
      .setCustomId(`driver|return_queue|sub=use_original${gidParam}`)
      .setLabel(`出勤時の場所`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🏠'),
  ];

  if (lastDropOff) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`driver|return_queue|sub=use_last${gidParam}`)
        .setLabel(`直前の送迎場所`)
        .setStyle(ButtonStyle.Success)
        .setEmoji('📍')
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`driver|return_queue|sub=use_other${gidParam}`)
      .setLabel('その他（手動入力）')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('✏️')
  );

  const row = new ActionRowBuilder().addComponents(buttons);

  await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
}

/**
 * 待機列復帰前の現在地入力モーダルを表示（「その他」選択時）
 */
async function showReturnQueueModal(interaction, parsed) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

  const guildId = interaction.guildId || parsed?.params?.gid;
  const gidParam = guildId ? `&gid=${guildId}` : '';

  const modal = new ModalBuilder()
    .setCustomId(`driver|return_queue|sub=submit${gidParam}`)
    .setTitle('待機列に復帰');

  const input = new TextInputBuilder()
    .setCustomId('location')
    .setLabel('現在の居場所 (必須)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 〇〇駅前、△△ビル付近')
    .setRequired(true)
    .setMaxLength(50);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

/**
 * 出勤時の場所で待機列に復帰
 */
async function handleReturnQueueUseOriginal(interaction, client, parsed) {
  const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
  const { ACK } = autoInteractionTemplate;
  const { loadDriver } = require('../../utils/driversStore');

  return autoInteractionTemplate(interaction, {
    ack: ACK.UPDATE,
    panelKey: 'driverPanel',
    async run(interaction) {
      const guildId = interaction.guildId || parsed?.params?.gid;
      const userId = interaction.user.id;

      const driverData = await loadDriver(guildId, userId).catch(() => null);
      if (!driverData) {
        return interaction.followUp({ content: '⚠️ 送迎者データが見つかりません。', flags: 64 });
      }

      const actualData = driverData.current || driverData;
      const location = actualData.stopPlace || '不明';

      await returnToQueue(interaction, client, location);
    }
  });
}

/**
 * 直前の送迎場所で待機列に復帰
 */
async function handleReturnQueueUseLast(interaction, client, parsed) {
  const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
  const { ACK } = autoInteractionTemplate;
  const { loadDriver } = require('../../utils/driversStore');

  return autoInteractionTemplate(interaction, {
    ack: ACK.UPDATE,
    panelKey: 'driverPanel',
    async run(interaction) {
      const guildId = interaction.guildId || parsed?.params?.gid;
      const userId = interaction.user.id;

      const driverData = await loadDriver(guildId, userId).catch(() => null);
      if (!driverData || !driverData.lastDropOffLocation) {
        return interaction.followUp({ content: '⚠️ 直前の送迎場所が見つかりません。', flags: 64 });
      }

      const location = driverData.lastDropOffLocation;

      await returnToQueue(interaction, client, location);
    }
  });
}

/**
 * 待機列復帰の共通処理
 */
async function returnToQueue(interaction, client, location, guildIdArg = null) {
  const guildId = guildIdArg || interaction.guildId;
  const userId = interaction.user.id;
  const { loadDriver } = require('../../utils/driversStore');

  // 1. 待機中チェック
  const waitPath = `${paths.waitingDriversDir(guildId)}/${userId}.json`;
  const isWaiting = (await store.readJson(waitPath).catch(() => null)) !== null;
  if (isWaiting) {
    return interaction.followUp({ content: '✅ 既に待機リストに登録されています。', flags: 64 });
  }

  // 2. 運行中チェック
  const activeFiles = await store.listKeys(paths.activeDispatchDir(guildId)).catch(() => []);
  for (const fileKey of activeFiles) {
    const rideData = await store.readJson(fileKey).catch(() => null);
    if (rideData && rideData.driverId === userId && rideData.status !== 'finished' && rideData.status !== 'completed') {
      return interaction.followUp({
        content: '⚠️ まだ現在運行中の送迎があります。すべての送迎を終了させてから待機に戻ってください。',
        flags: 64
      });
    }
  }

  // 3. プロフィール取得
  const driverData = await loadDriver(guildId, userId).catch(() => null);
  if (!driverData) {
    return interaction.followUp({ content: '⚠️ 送迎者データが見つかりません。通常の出勤ボタンから出勤してください。', flags: 64 });
  }

  const actualData = driverData.current || driverData;
  const carInfo = actualData.car || actualData.carInfo || '不明';
  const capacity = actualData.capacity || '不明';

  // 4. 待機列へ追加
  const queueData = {
    userId,
    carInfo,
    capacity,
    stopPlace: location,
    timestamp: new Date().toISOString(),
  };
  await store.writeJson(waitPath, queueData);

  // 5. パネル更新
  const guild = interaction.guild || (guildId ? await client.guilds.fetch(guildId).catch(() => null) : null);
  updateRelevantPanels(guild, client);

  // 6. ログ
  const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');
  const embed = buildPanelEmbed({
    title: '🚗 送迎者 待機復帰',
    description: `<@${userId}> が送迎を終え、待機列に復帰しました。`,
    color: 0x3498db,
    client: interaction.client,
    fields: [
      { name: '📍 現在地', value: location, inline: true },
      { name: '📋 車両情報', value: `${carInfo} (${capacity})`, inline: true },
    ]
  });

  await postOperatorLog({
    guild: guild,
    embeds: [embed],
  }).catch(() => null);

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return interaction.followUp({
    content: `※待機復帰：<@${userId}> (${timeStr}) [場所: ${location}]`,
    flags: 64
  });
}

/**
 * 送迎終了後に待機列へ復帰する処理 (モーダル送信後)
 */
async function handleReturnQueueSubmit(interaction, client, parsed) {
  const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
  const { ACK } = autoInteractionTemplate;

  return autoInteractionTemplate(interaction, {
    ack: ACK.REPLY_EPHEMERAL,
    panelKey: 'driverPanel',
    async run(interaction) {
      const location = interaction.fields.getTextInputValue('location');
      const guildId = interaction.guildId || parsed?.params?.gid;
      await returnToQueue(interaction, client, location, guildId);
    }
  });
}

module.exports = {
  buildDriverPanelMessage,
  updateDriverPanel,
  updateRideListPanel,
  updateRelevantPanels,
  execute,
  buildRideListPanelMessage,
};
