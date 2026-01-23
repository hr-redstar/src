const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { formatDateShort } = require('../../utils/共通/日付フォーマット');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');

/**
 * 評価システム - 送迎終了後の相互評価フロー
 */

/**
 * 送迎終了時に相互に評価依頼DMを送付
 */
async function sendRatingDM(guild, dispatchData) {
  const {
    dispatchId,
    driverId,
    passengerId,
    direction,
    route,
    createdAt,
    driverStartTime,
    driverEndTime,
    userStartTime,
    userEndTime,
    completedAt,
  } = dispatchData;

  const dateObj = new Date(completedAt || createdAt || Date.now());
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${y}年${m}月${d}日`;

  // ルート詳細 (仕様 #16 準拠)
  const routeDisplay = route || direction || '経路情報なし';

  // 時間経過
  const timeline = [
    driverStartTime || userStartTime ? `⌚ ${driverStartTime || userStartTime}` : null,
    driverEndTime || userEndTime ? `🏁 ${driverEndTime || userEndTime}` : null
  ].filter(Boolean).join(' ～ ') || '--:--';

  const passenger = await guild.client.users.fetch(passengerId).catch(() => null);
  const driver = await guild.client.users.fetch(driverId).catch(() => null);

  // 利用者へのDM（送迎者を評価）
  const sendToPassenger = async (user) => {
    if (!user) return;
    const embed = buildPanelEmbed({
      title: '送迎者・利用者口コミ評価',
      description: `今回の送迎はいかがでしたか？\n評価をお願いいたします。\n\n📅 **${dateStr}**\n🗺️ **経路**: ${routeDisplay}\n⏱️ **状況**: ${timeline}`,
      color: 0xffd700,
      client: guild.client
    });

    await user
      .send(buildPanelMessage({
        embed,
        components: buildRatingButtons('driver', dispatchId)
      }))
      .catch(() => null);
  };

  await sendToPassenger(passenger);

  // 相乗り者にも評価依頼を送信 (v1.5.0)
  const { carpoolUsers } = dispatchData;
  if (carpoolUsers && carpoolUsers.length > 0) {
    for (const cp of carpoolUsers) {
      if (cp.userId === passengerId) continue; // メイン利用者と重複防止
      const cpUser = await guild.client.users.fetch(cp.userId).catch(() => null);
      await sendToPassenger(cpUser);
    }
  }

  // 送迎者へのDM（メイン利用者を評価）
  if (driver) {
    const embed = buildPanelEmbed({
      title: '送迎者・利用者口コミ評価',
      description: `今回の利用者はいかがでしたか？\n評価をお願いいたします。\n\n📅 **${dateStr}**\n🗺️ **経路**: ${routeDisplay}\n⏱️ **状況**: ${timeline}`,
      color: 0xffd700,
      client: guild.client
    });

    await driver
      .send(buildPanelMessage({
        embed,
        components: buildRatingButtons('user', dispatchId)
      }))
      .catch(() => null);
  }
}

/**
 * 評価用ボタンの構築
 */
function buildRatingButtons(targetType, dispatchId) {
  // 1行目: ⭐5, ⭐4
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|rating|type=${targetType}&did=${dispatchId}&val=5`)
      .setLabel('⭐ 5')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`dispatch|rating|type=${targetType}&did=${dispatchId}&val=4`)
      .setLabel('⭐ 4')
      .setStyle(ButtonStyle.Primary)
  );
  // 2行目: ⭐3, ⭐2, ⭐1
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|rating|type=${targetType}&did=${dispatchId}&val=3`)
      .setLabel('⭐ 3')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`dispatch|rating|type=${targetType}&did=${dispatchId}&val=2`)
      .setLabel('⭐ 2')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`dispatch|rating|type=${targetType}&did=${dispatchId}&val=1`)
      .setLabel('⭐ 1')
      .setStyle(ButtonStyle.Secondary)
  );
  // 3行目: コメント
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|rating|type=${targetType}&did=${dispatchId}&val=comment`)
      .setLabel('💬 コメントも書きたい')
      .setStyle(ButtonStyle.Success)
  );

  return [row1, row2, row3];
}

/**
 * インタラクションハンドラー
 */
async function execute(interaction, client, parsed) {
  const targetType = parsed?.params?.type;
  const dispatchId = parsed?.params?.did;
  const value = parsed?.params?.val;

  const guildId = interaction.guildId || (await findGuildIdByDispatchId(dispatchId));
  if (!guildId) return;

  if (value === 'comment') {
    const modal = new ModalBuilder()
      .setCustomId(`dispatch|rating|sub=modal&type=${targetType}&did=${dispatchId}`)
      .setTitle('評価コメント入力');

    const input = new TextInputBuilder()
      .setCustomId('comment')
      .setLabel('口コミ・コメント')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('今回の送迎や利用について、詳しく教えてください。')
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return interaction.showModal(modal);
  }

  const stars = parseInt(value, 10);
  if (isNaN(stars)) return;

  return autoInteractionTemplate(interaction, {
    ack: ACK.UPDATE,
    async run(interaction) {
      const result = await saveRating(guildId, targetType, dispatchId, interaction.user.id, {
        stars,
      });
      await postRatingToMemo(
        interaction.guild || (await client.guilds.fetch(guildId)),
        targetType,
        dispatchId,
        result.current
      );
      const embed = buildPanelEmbed({
        title: '✅ 評価をありがとうございます',
        description: `満足度 **⭐ ${stars}** を記録しました。\n引き続き口コミ・コメントを送信することも可能です。`,
        color: 0x2ecc71,
        client: interaction.client
      });
      await interaction.editReply({
        embeds: [embed],
      });
    },
  });
}

/**
 * モーダル送信時の処理
 */
async function handleModalSubmit(interaction, client, parsed) {
  const targetType = parsed?.params?.type;
  const dispatchId = parsed?.params?.did;
  const comment = interaction.fields.getTextInputValue('comment');

  const guildId = interaction.guildId || (await findGuildIdByDispatchId(dispatchId));
  if (!guildId) return;

  return autoInteractionTemplate(interaction, {
    ack: ACK.REPLY,
    async run(interaction) {
      const result = await saveRating(guildId, targetType, dispatchId, interaction.user.id, {
        comment,
      });
      // メモチャンネルへの通知
      const guild = interaction.guild || (await interaction.client.guilds.fetch(guildId));
      await postRatingToMemo(guild, targetType, dispatchId, result.current);

      const embed = buildPanelEmbed({
        title: '✅ 口コミをありがとうございます',
        description: '貴重なフィードバックを承りました。\n今後のサービス品質向上のために活用させていただきます。',
        color: 0x2ecc71,
        client: interaction.client
      });
      await interaction.editReply({
        embeds: [embed],
      });
      if (interaction.message) {
        await interaction.message
          .edit({ components: buildRatingButtons(targetType, dispatchId) })
          .catch(() => null);
      }
    },
  });
}

/**
 * 評価の保存（ユーザー別フォルダへ集約）
 */
async function saveRating(guildId, targetType, dispatchId, raterId, data) {
  const paths = require('../../utils/ストレージ/ストレージパス');
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  // 1. 対象ユーザーを特定
  const historyPath = `${paths.dispatchHistoryDir(guildId, y, m)}/${dispatchId}.json`;
  const dispatchData = await store.readJson(historyPath).catch(() => null);

  if (!dispatchData) {
    logger.error('評価保存失敗: 配車データが見つかりません', { dispatchId });
    throw new Error('配車データが見つかりません。');
  }

  const targetUserId = targetType === 'driver' ? dispatchData.driverId : dispatchData.passengerId;
  if (!targetUserId) {
    logger.error('評価保存失敗: 対象ユーザーを特定できません', { dispatchId, targetType });
    throw new Error('対象ユーザーを特定できません。');
  }

  // 2. 保存パスの決定
  const ratingPath =
    targetType === 'driver'
      ? paths.driverRatingJson(guildId, targetUserId, y, m, d)
      : paths.userRatingJson(guildId, targetUserId, y, m, d);

  // 2-B. グローバルログ (管理者向け: 全体把握用)
  const typeDir = targetType === 'driver' ? '送迎者' : '利用者';
  const globalRatingPath = `${paths.ratingLogsDir(guildId)}/${typeDir}/${dispatchId}.json`;
  await store.writeJson(globalRatingPath, {
    ...data,
    raterId,
    updatedAt: now.toISOString(),
    targetUserId,
  });

  // 3. データの更新保存 (配列形式で追記)
  let result = null;
  await store.updateJson(ratingPath, (existing) => {
    const ratingEntry = {
      ...data,
      dispatchId,
      raterId,
      updatedAt: now.toISOString(),
    };

    if (!existing || !Array.isArray(existing)) {
      result = { current: ratingEntry, history: [ratingEntry] };
      return [ratingEntry];
    }

    // 同一 dispatchId の評価があれば上書き、なければ追記
    const index = existing.findIndex((r) => r.dispatchId === dispatchId);
    if (index >= 0) {
      existing[index] = ratingEntry;
    } else {
      existing.push(ratingEntry);
    }

    result = { current: ratingEntry, history: existing };
    return existing;
  });

  // 4. サマリーの再計算・更新
  const { recalculateRatingSummary } = require('../../utils/ratingsStore');
  await recalculateRatingSummary(guildId, targetUserId, targetType).catch((err) =>
    console.error('評価サマリー更新失敗', err)
  );

  return result;
}

/**
 * ユーザーメモチャンネルへの投稿
 */
async function postRatingToMemo(guild, targetType, dispatchId, ratingData) {
  const { loadConfig } = require('../../utils/設定/設定マネージャ');
  const { findUserMemoChannel } = require('../../utils/findUserMemoChannel');
  const { loadUserFull } = require('../../utils/usersStore');
  const { loadDriverFull } = require('../../utils/driversStore');
  const { getOrCreateHistoryThread } = require('../../utils/getOrCreateHistoryThread');

  const config = await loadConfig(guild.id);
  const memoCategoryId = config.categories?.userMemo;
  if (!memoCategoryId) return;

  // 1. 配車データの取得
  const dateObj = new Date(ratingData.updatedAt || Date.now());
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  const historyPath = `${paths.dispatchHistoryDir(guild.id, y, m)}/${dispatchId}.json`;
  const dispatchData = await store.readJson(historyPath).catch(() => null);

  let targetUserId = null;
  let routeInfo = '経路情報なし';
  let threadPolicy = null;

  if (dispatchData) {
    targetUserId = targetType === 'driver' ? dispatchData.driverId : dispatchData.passengerId;
    routeInfo = dispatchData.route || dispatchData.direction || routeInfo;
  } else {
    // フォールバック (dispatchId から推測)
    const parts = dispatchId.split('_');
    if (parts[0] === 'manual') {
      targetUserId = targetType === 'driver' ? parts[1] : parts[2];
    }
  }

  if (!targetUserId) return;

  // 2. ユーザーデータとポリシーの取得
  let fullData = null;
  if (targetType === 'driver') {
    fullData = await loadDriverFull(guild.id, targetUserId);
  } else {
    fullData = await loadUserFull(guild.id, targetUserId);
  }
  threadPolicy = fullData?.threadPolicy;

  // 3. メモチャンネルとスレッドの特定
  const channel = await findUserMemoChannel({
    guild,
    userId: targetUserId,
    categoryId: memoCategoryId,
  });
  if (!channel) return;

  const thread = await getOrCreateHistoryThread(channel, threadPolicy, dateObj);
  const target = thread || channel;

  // 4. 埋め込み作成 (仕様 #30 準拠)
  const starsStr = ratingData.stars ? '⭐'.repeat(ratingData.stars) : '評価なし';
  const d = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${y}年${m}月${d}日`;

  const embed = new EmbedBuilder()
    .setTitle(`送迎者・利用者口コミ評価`)
    .setDescription(
      `**${routeInfo}**　${dateStr}\n\n` +
      `<@${ratingData.raterId}> 様より評価が届きました。`
    )
    .addFields(
      { name: '満足度', value: starsStr, inline: true },
      { name: 'コメント', value: ratingData.comment || '（なし）', inline: false }
    )
    .setFooter({ text: `送迎ID: ${dispatchId}` })
    .setTimestamp(dateObj)
    .setColor(0xffd700);

  await target.send({ embeds: [embed] }).catch(() => null);
}

async function findGuildIdByDispatchId(dispatchId) {
  const parts = dispatchId.split('_');
  return parts[parts.length - 1];
}

module.exports = {
  sendRatingDM,
  execute,
  handleModalSubmit,
};
