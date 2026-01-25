const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 配車依頼フロー (v2.8.0)
 * 方面選択 -> 人数選択 -> 確認 -> 実行
 */
module.exports = {
  execute: async function (interaction, client, parsed) {
    const sub = parsed?.params?.sub || 'direction';
    const type = parsed?.params?.type || 'cast';
    const dirIdx = parsed?.params?.dir_idx !== undefined ? parseInt(parsed.params.dir_idx) : -1;
    const direction = parsed?.params?.dir || '';
    const persons = parsed?.params?.p || '';

    return autoInteractionTemplate(interaction, {
      ack: (sub === 'direction' ? ACK.REPLY : ACK.AUTO),
      async run(interaction) {
        switch (sub) {
          case 'direction':
            return showDirectionSelection(interaction, type);
          case 'persons':
            return showPersonsSelection(interaction, type, dirIdx, direction);
          case 'guest_modal':
            return showGuestModal(interaction);
          case 'confirm':
            // セレクトメニューからの場合は values から取得
            const selectedPersons = interaction.values ? interaction.values[0] : persons;
            return showConfirmation(interaction, type, dirIdx, direction, selectedPersons);
          case 'dest_modal':
            return handleDestModal(interaction, type, dirIdx, direction, persons);
          case 'execute':
            return executeDispatch(interaction, type, dirIdx, direction, persons);
          case 'cancel':
            return interaction.editReply({ content: '❌ 配車依頼をキャンセルしました。', embeds: [], components: [] });

          // 既存の運行管理系 (did)
          case 'heading':
            return handleHeading(interaction, parsed?.params?.did);
          case 'ride_start':
            return handleRideStart(interaction, parsed?.params?.did);
          case 'complete':
            return handleComplete(interaction, parsed?.params?.did);

          // 相乗り
          case 'carpool_join':
            return handleCarpoolJoin(interaction, parsed?.params?.rid);
          case 'carpool_modal':
            return handleCarpoolModal(interaction, parsed?.params?.rid);
          case 'wait_for_driver':
            return handleWaitForDriver(interaction, type, dirIdx, direction, persons);

          default:
            return showDirectionSelection(interaction, type);
        }
      },
    });
  },
};

/**
 * STEP 1: 方面選択
 */
async function showDirectionSelection(interaction, type) {
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');

  // 運営設定から方角リストを読み込む
  const dirListPath = paths.directionsListJson(interaction.guildId);
  const directionsList = await store.readJson(dirListPath, []).catch(() => []);

  // 有効な方角のみを抽出
  const directions = directionsList
    .filter((d) => d.enabled !== false)
    .map((d) => d.name.replace(/【|】/g, ''));

  const embed = buildPanelEmbed({
    title: '🗺️ 配車依頼 - 方面選択',
    description: '目的地（方面）を選択してください。',
    fields: [
      { name: '👤 依頼種別', value: type === 'cast' ? 'キャスト' : 'ゲスト', inline: true }
    ],
    color: 0x3498db,
    client: interaction.client
  });

  const rows = [];
  let currentRow = new ActionRowBuilder();

  if (directions.length === 0) {
    // 方面が登録されていない場合
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`dispatch|order|sub=persons&type=${type}&dir_idx=-1`)
        .setLabel('指定なし (そのまま進む)')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(currentRow);
  } else {
    // 各方角ボタンを5列x5行まで表示（インデックスを使用）
    directions.forEach((dir, index) => {
      if (index > 0 && index % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`dispatch|order|sub=persons&type=${type}&dir_idx=${index}`)
          .setLabel(dir.substring(0, 20)) // ボタンラベルは20文字まで
          .setStyle(ButtonStyle.Success)
      );
    });
    rows.push(currentRow);
  }

  await interaction.editReply({ embeds: [embed], components: rows });
}

/**
 * STEP 2: 人数選択
 */
async function showPersonsSelection(interaction, type, dirIdx, direction) {
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');

  // インデックスから方面名を取得
  let displayDir = direction || '指定なし';
  if (dirIdx >= 0) {
    const dirListPath = paths.directionsListJson(interaction.guildId);
    const directionsList = await store.readJson(dirListPath, []).catch(() => []);
    const validDirs = directionsList.filter((d) => d.enabled !== false);
    if (dirIdx < validDirs.length) {
      displayDir = validDirs[dirIdx].name.replace(/【|】/g, '');
    }
  }

  const embed = buildPanelEmbed({
    title: '👥 配車依頼 - 人数選択',
    description: 'ご乗車される人数を選択してください。',
    fields: [
      { name: '👤 種別', value: type === 'cast' ? 'キャスト' : 'ゲスト', inline: true },
      { name: '🗺️ 方面', value: displayDir, inline: true }
    ],
    color: 0x3498db,
    client: interaction.client
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`dispatch|order|sub=confirm&type=${type}&dir_idx=${dirIdx}`)
    .setPlaceholder('人数を選択してください')
    .addOptions([
      { label: '1名', value: '1', emoji: '👤' },
      { label: '2名', value: '2', emoji: '👥' },
      { label: '3名', value: '3' },
      { label: '4名', value: '4' },
      { label: '5名', value: '5' },
      { label: '6名', value: '6' },
    ]);

  const row = new ActionRowBuilder().addComponents(select);

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=direction&type=${type}`)
      .setLabel('← 戻る')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [embed], components: [row, navRow] });
}

/**
 * STEP 2 (Guest Only): ゲスト用入力モーダル
 */
async function showGuestModal(interaction) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
  const modal = new ModalBuilder()
    .setCustomId(`dispatch|order|sub=dest_modal&type=guest`)
    .setTitle('ゲスト送迎依頼入力');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('destination')
        .setLabel('目的地・店名など')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('例：〇〇ホテル、△△ビル前')
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('count')
        .setLabel('乗車人数 (1-6)')
        .setStyle(TextInputStyle.Short)
        .setValue('1')
        .setMaxLength(1)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('note')
        .setLabel('補足情報（目印・連絡事項など）')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('例：東口のタクシー乗り場付近にいます')
        .setRequired(false)
    )
  );

  await interaction.showModal(modal);
}

/**
 * STEP 3 (Guest Only): モーダル処理
 */
async function handleDestModal(interaction, type, direction, persons) {
  const destination = interaction.fields.getTextInputValue('destination');
  const count = interaction.fields.getTextInputValue('count');
  const note = interaction.fields.getTextInputValue('note');

  // ゲストの場合は方面(direction)は「指定なし」または「ゲスト」として扱う
  return showConfirmation(interaction, type, 'ゲスト（直接入力）', count, destination, note);
}

/**
 * STEP 4: 最終確認
 */
async function showConfirmation(interaction, type, dirIdx, direction, persons, destination = '', note = '') {
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');

  // インデックスから方面名を取得
  let displayDir = direction || '指定なし';
  if (dirIdx >= 0) {
    const dirListPath = paths.directionsListJson(interaction.guildId);
    const directionsList = await store.readJson(dirListPath, []).catch(() => []);
    const validDirs = directionsList.filter((d) => d.enabled !== false);
    if (dirIdx < validDirs.length) {
      displayDir = validDirs[dirIdx].name.replace(/【|】/g, '');
    }
  }

  const fields = [
    { name: '👤 種別', value: type === 'cast' ? 'キャスト' : 'ゲスト', inline: true },
    { name: '🗺️ 方面', value: displayDir, inline: true },
    { name: '👥 人数', value: `${persons}名`, inline: true }
  ];

  if (destination) {
    fields.push({ name: '📍 目的地', value: destination, inline: false });
  }
  if (note) {
    fields.push({ name: '📝 補足', value: note, inline: false });
  }

  const embed = buildPanelEmbed({
    title: '🚕 配車依頼 - 内容確認',
    description: '以下の内容で配車を依頼します。内容に間違いがないかご確認ください。',
    fields,
    color: 0xf1c40f,
    client: interaction.client
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=execute&type=${type}&dir_idx=${dirIdx}&p=${persons}${destination ? `&dest=${destination}` : ''}${note ? `&nt=${note}` : ''}`)
      .setLabel('配車を確定する')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=cancel`)
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * STEP 5: 実行
 */
async function executeDispatch(interaction, type, dirIdx, direction, persons) {
  const { popNextDriver } = require('../../utils/配車/待機列マネージャ');
  const createDispatchVC = require('../送迎処理/createDispatchVC');
  const config = await loadConfig(interaction.guildId);

  // インデックスから方面名を取得
  let finalDirection = direction || '指定なし';
  if (dirIdx >= 0) {
    const dirListPath = paths.directionsListJson(interaction.guildId);
    const directionsList = await store.readJson(dirListPath, []).catch(() => []);
    const validDirs = directionsList.filter((d) => d.enabled !== false);
    if (dirIdx < validDirs.length) {
      finalDirection = validDirs[dirIdx].name.replace(/【|】/g, '');
    }
  }

  // interaction.customId からパースするのが確実
  const urlParts = interaction.customId.split('?')[1];
  const query = urlParts ? new URLSearchParams(urlParts) : null;
  const dest = query ? query.get('dest') : '';
  const note = query ? query.get('nt') : '';

  // 1. マッチング処理
  const driverData = await popNextDriver(interaction.guildId);
  if (!driverData) {
    const waitEmbed = new EmbedBuilder()
      .setTitle('⚠️ 送迎車不在')
      .setDescription('申し訳ありません、現在待機中の送迎車がいません。\n送迎車が空くまで「待機リスト」に登録して待ちますか？')
      .setColor(0xf1c40f);

    const waitRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dispatch|order|sub=wait_for_driver&type=${type}&dir_idx=${dirIdx}&p=${persons}${dest ? `&dest=${dest}` : ''}${note ? `&nt=${note}` : ''}`)
        .setLabel('待機リストに登録する')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`dispatch|order|sub=cancel`)
        .setLabel('キャンセル')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.editReply({
      embeds: [waitEmbed],
      components: [waitRow]
    });
  }

  const rideId = `${Date.now()}_${interaction.user.id}`;
  const dispatchData = {
    rideId,
    userId: interaction.user.id,
    driverId: driverData.userId,
    driverPlace: driverData.stopPlace || '不明',
    direction: finalDirection,
    count: parseInt(persons),
    destination: dest || finalDirection, // モーダル入力があればそれを使用
    note: note, // ゲスト用の補足情報
    status: 'dispatching',
    startedAt: new Date().toISOString(),
    guest: type === 'guest',
  };

  // 2. VC作成 & 通知 (共通ロジックに委譲)
  await createDispatchVC({
    guild: interaction.guild,
    requester: interaction.user,
    driverId: driverData.userId,
    driverPlace: dispatchData.driverPlace,
    dispatchData,
    config
  });

  // 3. 完了応答は createDispatchVC 内で完結させることも可能だが、
  // editReply の最終的なメッセージをここで出す
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');
  const successEmbed = buildPanelEmbed({
    title: '✅ 配車依頼完了',
    description: [
      `📍 **出発地**: ${dispatchData.driverPlace}`,
      `🚗 **担当者**: <@${driverData.userId}>`,
      '',
      'マッチングが成功しました。',
      '専用のプライベートVCが作成されましたので、DMの指示に従って参加してください。'
    ].join('\n'),
    color: 0x2ecc71,
    client: interaction.client
  });

  await interaction.editReply({ content: null, embeds: [successEmbed], components: [] });
}

/** --- 運行管理系ロジック (既存維持・一部調整) --- **/

/**
 * 向かっています処理
 */
async function handleHeading(interaction, dispatchId) {
  const paths = require('../../utils/ストレージ/ストレージパス');
  const store = require('../../utils/ストレージ/ストア共通');
  const activePath = `${paths.activeDispatchDir(interaction.guildId)}/${dispatchId}.json`;
  const data = await store.readJson(activePath).catch(() => null);
  if (!data) return interaction.editReply('⚠️ 配車データが見つかりません。');

  const now = new Date();
  const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  data.status = 'heading';
  data.headingAt = now.toISOString();
  await store.writeJson(activePath, data);

  const buildPanelEmbed = require('../../utils/embed/embedTemplate');
  const embed = buildPanelEmbed({
    title: '🚙 向かっています',
    description: '送迎者が現在地または合流場所へ向かっています。到着まで少々お待ちください。',
    fields: [
      { name: '👤 依頼者', value: data.passengerTag || `<@${data.userId}>`, inline: true },
      { name: '🗺️ 方面/目的地', value: data.direction, inline: true },
      { name: '⏱️ 更新時刻', value: `\`${timeStr}\``, inline: false }
    ],
    color: 0x3498db,
    client: interaction.client
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=heading&did=${dispatchId}`)
      .setLabel('向かっています')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=ride_start&did=${dispatchId}`)
      .setLabel('送迎開始')
      .setStyle(ButtonStyle.Success)
      .setDisabled(false),
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=complete&did=${dispatchId}`)
      .setLabel('送迎終了')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * 送迎開始処理
 */
async function handleRideStart(interaction, dispatchId) {
  const paths = require('../../utils/ストレージ/ストレージパス');
  const store = require('../../utils/ストレージ/ストア共通');
  const activePath = `${paths.activeDispatchDir(interaction.guildId)}/${dispatchId}.json`;
  const data = await store.readJson(activePath).catch(() => null);
  if (!data) return interaction.editReply('⚠️ 配車データが見つかりません。');

  const now = new Date();
  const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  data.status = 'riding';
  const rolePrefix = interaction.user.id === data.driverId ? '送迎者' : '利用者';
  if (rolePrefix === '送迎者') data.driverStartTime = timeStr;
  else data.userStartTime = timeStr;

  await store.writeJson(activePath, data);

  if (data.driverStartTime && data.userStartTime) {
    const { updateRideOperatorLog } = require('../../utils/ログ/rideLogManager');
    await updateRideOperatorLog({
      guild: interaction.guild,
      rideId: dispatchId,
      status: 'STARTED',
      data: {
        driverId: data.driverId,
        userId: data.userId,
        area: data.direction,
      }
    }).catch(() => null);
  }

  const buildPanelEmbed = require('../../utils/embed/embedTemplate');
  const embed = buildPanelEmbed({
    title: '🚀 送迎開始',
    description: '送迎が正常に開始されました。安全運転でお願いいたします。',
    fields: [
      { name: '👤 依頼者', value: data.passengerTag || `<@${data.userId}>`, inline: true },
      { name: '🚗 送迎者', value: `<@${data.driverId}>`, inline: true },
      { name: '⏱️ 送迎者開始', value: data.driverStartTime || '--:--', inline: true },
      { name: '⏱️ 利用者開始', value: data.userStartTime || '--:--', inline: true }
    ],
    color: 0xf1c40f,
    client: interaction.client
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=heading&did=${dispatchId}`)
      .setLabel('向かっています')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=ride_start&did=${dispatchId}`)
      .setLabel('送迎開始')
      .setStyle(ButtonStyle.Success)
      .setDisabled(data.driverStartTime && data.userStartTime),
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=complete&did=${dispatchId}`)
      .setLabel('送迎終了')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(false)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * 配送完了・帰庫処理
 */
async function handleComplete(interaction, dispatchId) {
  const paths = require('../../utils/ストレージ/ストレージパス');
  const store = require('../../utils/ストレージ/ストア共通');
  const activePath = `${paths.activeDispatchDir(interaction.guildId)}/${dispatchId}.json`;
  const data = await store.readJson(activePath).catch(() => null);
  if (!data) return interaction.editReply('⚠️ 配車データが見つかりません。');

  const now = new Date();
  const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  const rolePrefix = interaction.user.id === data.driverId ? '送迎者' : '利用者';
  if (rolePrefix === '送迎者') data.driverEndTime = timeStr;
  else data.userEndTime = timeStr;

  const isBothCompleted = data.driverEndTime && data.userEndTime;
  if (isBothCompleted) {
    data.status = 'finished';
    data.completedAt = now.toISOString();
  }

  await store.writeJson(activePath, data);

  const buildPanelEmbed = require('../../utils/embed/embedTemplate');
  const embed = buildPanelEmbed({
    title: isBothCompleted ? '✅ 送迎完了' : '🏁 送迎終了（確認待機中）',
    description: isBothCompleted
      ? '送迎がすべて完了しました。お疲れ様でした。'
      : '送迎の終了を確認しました。相手側の操作を待っています。',
    fields: [
      { name: '⏱️ 送迎者終了', value: data.driverEndTime || '--:--', inline: true },
      { name: '⏱️ 利用者終了', value: data.userEndTime || '--:--', inline: true }
    ],
    color: isBothCompleted ? 0x95a5a6 : 0xe74c3c,
    client: interaction.client
  });

  const rowArr = [];
  if (!isBothCompleted) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dispatch|order|sub=heading&did=${dispatchId}`)
        .setLabel('向かっています')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`dispatch|order|sub=ride_start&did=${dispatchId}`)
        .setLabel('送迎開始')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`dispatch|order|sub=complete&did=${dispatchId}`)
        .setLabel('送迎終了')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(interaction.user.id === data.driverId ? data.driverEndTime : data.userEndTime)
    );
    rowArr.push(row);
  }

  await interaction.editReply({ embeds: [embed], components: rowArr });

  if (isBothCompleted) {
    const { updateRideOperatorLog } = require('../../utils/ログ/rideLogManager');
    await updateRideOperatorLog({
      guild: interaction.guild,
      rideId: dispatchId,
      status: 'ENDED',
      data: {
        driverId: data.driverId,
        userId: data.userId,
        area: data.direction,
      }
    }).catch(() => null);

    const { incrementStat } = require('../../utils/ストレージ/統計ストア');
    await incrementStat(interaction.guildId, 'ride_completed').catch(() => null);

    try {
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const logDir = paths.dispatchHistoryDir(interaction.guildId, y, m);
      const logPath = `${logDir}/${dispatchId}.json`;
      await store.writeJson(logPath, data);

      if (data.driverId) {
        const driverHistoryPath = paths.driverRideHistoryJson(interaction.guildId, data.driverId, y, m, d);
        await store.updateJson(driverHistoryPath, (existing) => {
          if (!existing || !Array.isArray(existing)) return [data];
          existing.push(data);
          return existing;
        });
      }
      if (data.userId) {
        const userHistoryPath = paths.userRideHistoryJson(interaction.guildId, data.userId, y, m, d);
        await store.updateJson(userHistoryPath, (existing) => {
          if (!existing || !Array.isArray(existing)) return [data];
          existing.push(data);
          return existing;
        });
      }
    } catch (err) {
      console.error('ログ保存失敗', err);
    }

    const { pushToQueue } = require('../../utils/配車/待機列マネージャ');
    await pushToQueue(interaction.guildId, data.driverId);

    const { archiveChatToMemo } = require('../../utils/チャットアーカイブ');
    const archiveInfo = {
      guild: interaction.guild,
      channel: interaction.channel,
      dispatchId,
      title: `${data.direction} (${interaction.user.tag} 様)`,
    };
    await archiveChatToMemo({ ...archiveInfo, userId: data.driverId }).catch(() => null);
    await archiveChatToMemo({ ...archiveInfo, userId: data.userId }).catch(() => null);

    await store.deleteFile(activePath).catch(() => null);

    const finishEmbed = buildPanelEmbed({
      title: '✅ 送迎終了しました',
      description: '落とし物などのトラブルがなければ、1週間でこのVCチャンネルは自動的に削除されます。',
      color: 0x2ecc71,
      client: interaction.client
    });

    const finishRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dispatch|order|sub=extend&did=${dispatchId}`)
        .setLabel('削除期間を延長する')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ components: [] });
    await interaction.followUp({ embeds: [finishEmbed], components: [finishRow] });

    const updateRideListPanel = require('../送迎処理/一覧パネル更新');
    const { updateDriverPanel } = require('../送迎パネル/メイン');
    await Promise.all([
      updateRideListPanel(interaction.guild, interaction.client),
      updateDriverPanel(interaction.guild, interaction.client),
    ]).catch(() => null);

    const { sendRatingDM } = require('./評価システム');
    await sendRatingDM(interaction.guild, data).catch((err) => console.error('評価DM送信失敗', err));
  }
}

/**
 * 相乗り参加ボタン
 */
async function handleCarpoolJoin(interaction, rideId) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
  const modal = new ModalBuilder()
    .setCustomId(`dispatch|order|sub=carpool_modal&rid=${rideId}`)
    .setTitle('相乗り人数入力');

  const countInp = new TextInputBuilder()
    .setCustomId('count')
    .setLabel('追加の乗車人数')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1')
    .setRequired(true)
    .setMaxLength(1);

  modal.addComponents(new ActionRowBuilder().addComponents(countInp));
  await interaction.showModal(modal);
}

/**
 * 相乗り参加モーダル送信
 */
async function handleCarpoolModal(interaction, rideId) {
  const paths = require('../../utils/ストレージ/ストレージパス');
  const store = require('../../utils/ストレージ/ストア共通');
  const count = interaction.fields.getTextInputValue('count');
  const cpPath = `${paths.carpoolDir(interaction.guildId)}/${rideId}.json`;
  const carpoolData = await store.readJson(cpPath).catch(() => null);
  if (!carpoolData) return interaction.editReply('⚠️ 募集データが見つかりません。');

  const activePath = `${paths.activeDispatchDir(interaction.guildId)}/${carpoolData.dispatchId}.json`;
  const dispatchData = await store.readJson(activePath).catch(() => null);
  if (!dispatchData) return interaction.editReply('⚠️ 配車が既に終了しているか見つかりません。');

  if (carpoolData.currentUsers.some((u) => u.userId === interaction.user.id)) {
    return interaction.editReply('⚠️ 既に相乗りリストに含まれています。');
  }

  carpoolData.currentUsers.push({ userId: interaction.user.id, count: parseInt(count) });
  await store.writeJson(cpPath, carpoolData);

  await interaction.editReply('✅ 相乗りに参加しました。VCで合流してください。');
}

/**
 * 待機リストへの登録
 */
async function handleWaitForDriver(interaction, type, dirIdx, direction, persons) {
  const store = require('../../utils/ストレージ/ストア共通');
  const paths = require('../../utils/ストレージ/ストレージパス');
  const { updateRideListPanel } = require('../送迎処理/一覧パネル更新');
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');

  // インデックスから方面名を取得
  let finalDirection = direction || '指定なし';
  if (dirIdx >= 0) {
    const dirListPath = paths.directionsListJson(interaction.guildId);
    const directionsList = await store.readJson(dirListPath, []).catch(() => []);
    const validDirs = directionsList.filter((d) => d.enabled !== false);
    if (dirIdx < validDirs.length) {
      finalDirection = validDirs[dirIdx].name.replace(/【|】/g, '');
    }
  }

  const urlParts = interaction.customId.split('?')[1];
  const query = urlParts ? new URLSearchParams(urlParts) : null;
  const dest = query ? query.get('dest') : '';

  const waitData = {
    userId: interaction.user.id,
    direction: finalDirection,
    destination: dest || finalDirection,
    count: parseInt(persons),
    guest: type === 'guest',
    timestamp: new Date().toISOString(),
  };

  const waitDir = paths.waitingUsersDir(interaction.guildId);
  const fileName = type === 'guest' ? `${interaction.user.id}_guest.json` : `${interaction.user.id}.json`;
  await store.writeJson(`${waitDir}/${fileName}`, waitData);

  const embed = buildPanelEmbed({
    title: '✅ 待機リスト登録完了',
    description: '申し訳ありません、現在対応可能な送迎車がございません。待機リストに登録いたしましたので、車両が空き次第優先的にマッチング・通知が行われます。',
    fields: [
      { name: '📍 希望方面', value: finalDirection, inline: true },
      { name: '👥 希望人数', value: `${persons}名`, inline: true }
    ],
    color: 0x2ecc71,
    client: interaction.client
  });

  await interaction.editReply({
    embeds: [embed],
    components: []
  });

  // 送迎一覧パネルを更新
  await updateRideListPanel(interaction.guild, interaction.client).catch(() => null);
}

