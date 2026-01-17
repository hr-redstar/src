const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
} = require('discord.js');
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 配車依頼フロー（ボタンのみの対話型）
 */
module.exports = {
  execute: async function (interaction, parsed) {
    const step = parsed?.params?.sub || 'type';
    const type = parsed?.params?.type || '';
    const direction = parsed?.params?.dir || '';
    const count = parsed?.params?.cnt || '';

    return autoInteractionTemplate(interaction, {
      ack: (parsed?.params?.sub || 'type') === 'type' ? ACK.REPLY : ACK.AUTO,
      async run(interaction) {
        if (step === 'type') {
          return showTypeSelection(interaction);
        }
        if (step === 'direction') {
          return showDirectionSelection(interaction, type);
        }
        if (step === 'dest_input') {
          return showDestInput(interaction, type, direction);
        }
        if (step === 'dest_modal') {
          return handleDestModal(interaction, type, direction);
        }
        if (step === 'count') {
          return showCountSelection(interaction, type, direction, parsed?.params?.dest);
        }
        if (step === 'confirm') {
          return showConfirmation(interaction, type, direction, count, parsed?.params?.dest);
        }
        if (step === 'execute') {
          return executeDispatch(interaction, type, direction, count, parsed?.params?.dest);
        }
        if (step === 'heading') {
          return handleHeading(interaction, parsed?.params?.did);
        }
        if (step === 'ride_start') {
          return handleRideStart(interaction, parsed?.params?.did);
        }
        if (step === 'complete') {
          return handleComplete(interaction, parsed?.params?.did);
        }
        if (step === 'carpool_join') {
          return handleCarpoolJoin(interaction, parsed?.params?.rid);
        }
        if (step === 'carpool_modal') {
          return handleCarpoolModal(interaction, parsed?.params?.rid);
        }
      },
    });
  },
};

/**
 * STEP 1: 種別選択 [キャスト] or [ゲスト]
 */
async function showTypeSelection(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🚕 配車依頼 - 種別選択')
    .setDescription('ご乗車される方の種別を選択してください。')
    .setColor(0x0099ff);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=direction&type=cast`)
      .setLabel('キャスト')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=direction&type=guest`)
      .setLabel('ゲスト(お客様)')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * STEP 2: 方面選択
 */
async function showDirectionSelection(interaction, type) {
  const config = await loadConfig(interaction.guildId);
  const directions = config.directions || ['立川方面', '八王子市内', '相模原方面', 'その他'];

  const embed = new EmbedBuilder()
    .setTitle('🚕 配車依頼 - 方面選択')
    .setDescription(
      `種別: **${type === 'cast' ? 'キャスト' : 'ゲスト'}**\n\n目的地（方面）を選択してください。`
    )
    .setColor(0x0099ff);

  // ボタンが多すぎる場合はセレクトメニューに切り替えるが、まずはボタンで実装
  const rows = [];
  let currentRow = new ActionRowBuilder();

  directions.forEach((dir, index) => {
    if (index > 0 && index % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`dispatch|order|sub=dest_input&type=${type}&dir=${dir}`)
        .setLabel(dir)
        .setStyle(ButtonStyle.Success)
    );
  });
  rows.push(currentRow);

  // 戻るボタン
  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=type`)
      .setLabel('← 戻る')
      .setStyle(ButtonStyle.Danger)
  );
  rows.push(navRow);

  await interaction.editReply({ embeds: [embed], components: rows });
}

/**
 * STEP 2.5: 目的地ボタン表示
 */
async function showDestInput(interaction, type, direction) {
  const embed = new EmbedBuilder()
    .setTitle('🚕 配車依頼 - 目的地入力')
    .setDescription(
      `種別: **${type === 'cast' ? 'キャスト' : 'ゲスト'}**\n方面: **${direction}**\n\n具体的な目的地を入力してください（任意）。\n※入力が難しい場合は、そのままボタンを押して「次へ」進めます。`
    )
    .setColor(0x0099ff);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=dest_modal_trigger&type=${type}&dir=${direction}`)
      .setLabel('🎯 目的地を入力する')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=count&type=${type}&dir=${direction}&dest=`)
      .setLabel('スキップして次へ')
      .setStyle(ButtonStyle.Secondary)
  );

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=direction&type=${type}`)
      .setLabel('← 戻る')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [embed], components: [row, navRow] });
}

/**
 * MODAL TRIGGER (Modal logic is usually outside autoInteractionTemplate for showing, but handle inside)
 */
async function handleDestModalTrigger(interaction, type, direction) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
  const modal = new ModalBuilder()
    .setCustomId(`dispatch|order|sub=dest_modal&type=${type}&dir=${direction}`)
    .setTitle('目的地入力');

  const destInp = new TextInputBuilder()
    .setCustomId('dest')
    .setLabel('具体的な目的地 (任意)')
    .setPlaceholder('例: 〇〇ホテル、△△交差点')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(destInp));
  await interaction.showModal(modal);
}

/**
 * STEP 2.6: 目的地モーダル受付
 */
async function handleDestModal(interaction, type, direction) {
  const dest = interaction.fields.getTextInputValue('dest') || '';
  return showCountSelection(interaction, type, direction, dest);
}

/**
 * STEP 3: 人数選択
 */
async function showCountSelection(interaction, type, direction, dest) {
  const embed = new EmbedBuilder()
    .setTitle('🚕 配車依頼 - 人数選択')
    .setDescription(
      `種別: **${type === 'cast' ? 'キャスト' : 'ゲスト'}**\n方面: **${direction}**\n目的地: **${dest || '(未入力)'}**\n\n乗車人数を選択してください。`
    )
    .setColor(0x0099ff);

  const row = new ActionRowBuilder().addComponents(
    [1, 2, 3, 4, 5].map((n) =>
      new ButtonBuilder()
        .setCustomId(`dispatch|order|sub=confirm&type=${type}&dir=${direction}&dest=${dest}&cnt=${n}`)
        .setLabel(`${n}人`)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=dest_input&type=${type}&dir=${direction}`)
      .setLabel('← 戻る')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [embed], components: [row, navRow] });
}

/**
 * STEP 4: 最終確認
 */
async function showConfirmation(interaction, type, direction, count, dest) {
  const embed = new EmbedBuilder()
    .setTitle('🚕 配車依頼 - 最終確認')
    .setDescription(
      `以下の内容で配車を依頼します。よろしいですか？\n\n・種別: **${type === 'cast' ? 'キャスト' : 'ゲスト'}**\n・方面: **${direction}**\n・目的地: **${dest || '(未入力)'}**\n・人数: **${count}人**`
    )
    .setColor(0xffff00);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=execute&type=${type}&dir=${direction}&dest=${dest}&cnt=${count}`)
      .setLabel('配車を確定する')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=count&type=${type}&dir=${direction}&dest=${dest}`)
      .setLabel('やり直す')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * STEP 5: 実行（マッチングロジック呼び出し）
 */
async function executeDispatch(interaction, type, direction, count, dest) {
  // ここでFIFO先頭ドライバーを取得し、マッチング処理を行う
  const { popNextDriver } = require('../../utils/配車/待機列マネージャ');
  const driver = await popNextDriver(interaction.guildId);

  if (!driver) {
    return interaction.editReply({
      content:
        '⚠️ 現在、待機中の送迎車がいません。しばらく経ってから再度お試しいただくか、担当者へ直接ご連絡ください。',
      embeds: [],
      components: [],
    });
  }

  // マッチング成功
  const { incrementStat } = require('../../utils/ストレージ/統計ストア');
  await incrementStat(interaction.guildId, 'ride_matched').catch(() => null);

  const { startDispatch } = require('./配車開始');
  const dispatchId = await startDispatch({
    guild: interaction.guild,
    driver,
    passenger: interaction.user,
    type,
    direction: dest ? `${direction} / ${dest}` : direction,
    count,
  });

  const embed = new EmbedBuilder()
    .setTitle('✅ 配車マッチング成功！')
    .setDescription(
      `<@${driver.userId}> さんが配車されました。\n専用の連絡チャンネルを作成しました。`
    )
    .addFields(
      { name: '種別', value: type === 'cast' ? 'キャスト' : 'ゲスト', inline: true },
      { name: '方面/目的地', value: dest ? `${direction} / ${dest}` : direction, inline: true },
      { name: '人数', value: `${count}人`, inline: true }
    )
    .setColor(0x00ff00);

  await interaction.editReply({ embeds: [embed], components: [] });

  // 相乗り募集判定（キャストかつ特定条件）
  if (type === 'cast') {
    const { handleCarpoolRecruitment } = require('./相乗り処理');
    await handleCarpoolRecruitment(
      interaction.guild,
      interaction.user,
      direction,
      count,
      dispatchId,
      dest
    );
  }
}

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

  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  // 2番目のフィールド（index 1）が「向かっています」
  embed.spliceFields(1, 1, { name: '向かっています', value: timeStr, inline: true });
  embed.setColor(0x3498db);

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
  // 送迎者と利用者の区別が必要だが、ひとまず押した人の名前で記録
  const rolePrefix = interaction.user.id === data.driverId ? '送迎者' : '利用者';
  if (rolePrefix === '送迎者') data.driverStartTime = timeStr;
  else data.userStartTime = timeStr;

  await store.writeJson(activePath, data);

  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  // フィールド更新: 送迎者：index 2, 利用者：index 4
  if (rolePrefix === '送迎者') {
    embed.spliceFields(2, 1, { name: '送迎者 送迎開始', value: timeStr, inline: true });
  } else {
    embed.spliceFields(4, 1, { name: '利用者 送迎開始', value: timeStr, inline: true });
  }
  embed.setColor(0xffff00);

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
      .setDisabled(data.driverStartTime && data.userStartTime), // 両方押されていれば無効化
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

  // ステータス更新
  const rolePrefix = interaction.user.id === data.driverId ? '送迎者' : '利用者';
  if (rolePrefix === '送迎者') data.driverEndTime = timeStr;
  else data.userEndTime = timeStr;

  // 両方の完了を待つロジックを入れる場合はここで判定
  const isBothCompleted = data.driverEndTime && data.userEndTime;
  if (isBothCompleted) {
    data.status = 'finished';
    data.completedAt = now.toISOString();
  }

  await store.writeJson(activePath, data);

  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  // 送迎終了: 送迎者：index 3, 利用者：index 5
  if (rolePrefix === '送迎者') {
    embed.spliceFields(3, 1, { name: '送迎終了', value: timeStr, inline: true });
  } else {
    embed.spliceFields(5, 1, { name: '送迎終了', value: timeStr, inline: true });
  }

  if (isBothCompleted) {
    embed.setColor(0xe74c3c);
  }

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
        .setDisabled(interaction.user.id === data.driverId ? data.driverEndTime : data.userEndTime) // 自分が押したら無効化
    );
    rowArr.push(row);
  }

  await interaction.editReply({ embeds: [embed], components: rowArr });

  if (isBothCompleted) {
    // 0. 統計更新
    const { incrementStat } = require('../../utils/ストレージ/統計ストア');
    await incrementStat(interaction.guildId, 'ride_completed').catch(() => null);

    // 1. ログアーカイブ処理 (全体履歴へ移動)
    try {
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const logDir = paths.dispatchHistoryDir(interaction.guildId, y, m);
      const logPath = `${logDir}/${dispatchId}.json`;
      await store.writeJson(logPath, data);

      // 1-B. 送迎者個別ログ
      if (data.driverId) {
        const driverHistoryPath = paths.driverRideHistoryJson(interaction.guildId, data.driverId, y, m, d);
        await store.updateJson(driverHistoryPath, (existing) => {
          if (!existing || !Array.isArray(existing)) return [data];
          existing.push(data);
          return existing;
        });
      }
      // 1-C. 利用者個別ログ
      if (data.passengerId) {
        const userHistoryPath = paths.userRideHistoryJson(interaction.guildId, data.passengerId, y, m, d);
        await store.updateJson(userHistoryPath, (existing) => {
          if (!existing || !Array.isArray(existing)) return [data];
          existing.push(data);
          return existing;
        });
      }
    } catch (err) {
      console.error('ログ保存失敗', err);
    }

    // 2. ドライバーを待機列に戻す
    const { pushToQueue } = require('../../utils/配車/待機列マネージャ');
    await pushToQueue(interaction.guildId, data.driverId);

    // 3. チャットログアーカイブ (仕様 #13)
    const { archiveChatToMemo } = require('../../utils/チャットアーカイブ');
    const archiveInfo = {
      guild: interaction.guild,
      channel: interaction.channel,
      dispatchId,
      title: `${data.direction} (${data.passengerTag} 様)`,
    };
    await archiveChatToMemo({ ...archiveInfo, userId: data.driverId }).catch(() => null);
    await archiveChatToMemo({ ...archiveInfo, userId: data.passengerId }).catch(() => null);

    // 4. アクティブからは削除せず
    await store.deleteFile(activePath).catch(() => null);

    // 5. VC終了アナウンス
    const finishEmbed = new EmbedBuilder()
      .setTitle('✅ 送迎終了しました')
      .setDescription('落とし物などのトラブルがなければ、\n1週間でこのVCチャンネルは削除されます。\n\n※トラブルがあった場合は、削除延長を押してください。')
      .setColor(0x00ff00);

    const finishRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`dispatch|order|sub=extend&did=${dispatchId}`)
        .setLabel('削除延長')
        .setStyle(ButtonStyle.Secondary)
    );

    // 古いボタン列を消去
    await interaction.editReply({ components: [] });
    await interaction.followUp({ embeds: [finishEmbed], components: [finishRow] });

    // 5. パネル更新
    const updateRideListPanel = require('../送迎処理/一覧パネル更新');
    const { updateDriverPanel } = require('../送迎パネル/メイン');
    await Promise.all([
      updateRideListPanel(interaction.guild, interaction.client),
      updateDriverPanel(interaction.guild, interaction.client),
    ]).catch(() => null);

    // 6. 相互評価DM送信
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
  // モーダルは ACK 不要 ( interactionTemplate の外で呼ぶ or interactionTemplate で ACK.NONE )
  // ここでは interactionTemplate 内での呼び出しになるため、interaction.showModal が使える
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

  // 配車中データの取得
  const activePath = `${paths.activeDispatchDir(interaction.guildId)}/${carpoolData.dispatchId}.json`;
  const dispatchData = await store.readJson(activePath).catch(() => null);
  if (!dispatchData) return interaction.editReply('⚠️ 配車が既に終了しているか見つかりません。');

  // 重複チェック
  if (carpoolData.currentUsers.some((u) => u.userId === interaction.user.id)) {
    return interaction.editReply('⚠️ 既に相乗りリストに含まれています。');
  }

  // データ更新
  carpoolData.currentUsers.push({ userId: interaction.user.id, count: parseInt(count) });
  await store.writeJson(cpPath, carpoolData);

  // 統計更新
  const { incrementStat } = require('../../utils/ストレージ/統計ストア');
  await incrementStat(interaction.guildId, 'carpool_joined').catch(() => null);

  // プライベートチャンネルへの権限追加
  const { PermissionFlagsBits } = require('discord.js');
  const channel = await interaction.guild.channels.fetch(dispatchData.channelId).catch(() => null);
  if (channel) {
    await channel.permissionOverwrites.create(interaction.user.id, {
      [PermissionFlagsBits.ViewChannel]: true,
      [PermissionFlagsBits.SendMessages]: true,
      [PermissionFlagsBits.ReadMessageHistory]: true,
    });
    await channel.send(
      `➕ <@${interaction.user.id}> 様が相乗りに参加しました（追加人数: ${count}名）。`
    );
  }

  // 募集メッセージの更新
  const carpoolCh = await interaction.guild.channels.fetch(carpoolData.channelId).catch(() => null);
  if (carpoolCh) {
    const msg = await carpoolCh.messages.fetch(carpoolData.messageId).catch(() => null);
    if (msg) {
      const userList = carpoolData.currentUsers
        .map((u) => `<@${u.userId}> (${u.count}名)`)
        .join('\n');
      const embed = EmbedBuilder.from(msg.embeds[0]).setFields(
        { name: '方面', value: carpoolData.direction, inline: true },
        { name: '先発店舗', value: `<@${carpoolData.leadUserId}>`, inline: true },
        { name: '現在の乗員', value: userList, inline: false },
        {
          name: '募集状況',
          value: '相乗り希望者は下のボタンを押してください。出発前であれば追加可能です。',
          inline: false,
        }
      );
      await msg.edit({ embeds: [embed] });
    }
  }

  await interaction.editReply('✅ 相乗りに参加しました！連絡用チャンネルを確認してください。');
}
