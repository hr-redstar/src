// utils/配車/相乗りマネージャ.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');
const { loadConfig } = require('../設定/設定マネージャ');
const { formatDateShort } = require('../共通/日付フォーマット');

/**
 * 送迎者の最大乗車人数を取得
 */
async function getDriverCapacity(guildId, driverId) {
  // 待機中データに capacity があるはずだが、working になると消えている場合があるため
  // ActiveDispatch または ПользовательProfile から取得
  const { loadUser } = require('../usersStore');
  const user = await loadUser(guildId, driverId);
  return user?.capacity ? parseInt(user.capacity) : 4; // デフォルト4
}

/**
 * 残り乗車人数を計算
 */
async function calculateRemainingCapacity(guildId, rideData) {
  const driverId = rideData.driverId;
  const capacity = await getDriverCapacity(guildId, driverId);

  // 現在の乗員数 = 1 (依頼者) + 相乗り人数
  let currentCount = 1; // 依頼者本人
  if (rideData.guest) {
    // ゲストの場合も一旦1名として扱う（詳細人数不明なため）
  }

  if (rideData.carpoolUsers) {
    for (const user of rideData.carpoolUsers) {
      currentCount += user.count || 1;
    }
  }

  return Math.max(0, capacity - currentCount);
}

/**
 * 相乗り募集メッセージを投稿/更新
 */
async function postCarpoolRecruitment(guild, rideData, client) {
  const config = await loadConfig(guild.id);
  const channelId = config.rideShareChannel;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const remaining = await calculateRemainingCapacity(guild.id, rideData);
  if (remaining <= 0) {
    // 満員なら募集終了（メッセージ削除または更新）
    if (rideData.carpoolMessageId) {
      const msg = await channel.messages.fetch(rideData.carpoolMessageId).catch(() => null);
      if (msg) await msg.delete().catch(() => null);

      // データ更新
      rideData.carpoolMessageId = null;
      const activePath = `${paths.activeDispatchDir(guild.id)}/${rideData.rideId}.json`;
      await store.writeJson(activePath, rideData);
    }
    return;
  }

  // ルート詳細
  const from = rideData.driverPlace || '現在地';
  const to = rideData.direction || '不明';

  const startedAt = new Date(rideData.startedAt);
  const timeStr = startedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  const joinedCount = (rideData.carpoolUsers || []).reduce((sum, u) => sum + (u.count || 1), 0);
  const maxCapacity = remaining + joinedCount;

  const content = [
    `🚗 相乗り募集中　最大　${maxCapacity}名まで`,
    `【${from}】 → 【${to}】`,
    `現在　${joinedCount}名`
  ].join('\n');

  const embed = new EmbedBuilder()
    .setDescription(
      `🕒 出発時刻（送迎者現在地）\n` +
      `${timeStr}\n\n` +
      `⚠️ 注意\n` +
      `相乗り希望後、すでに合流が難しい場合があります。\n` +
      `その際は送迎可能か送迎者から連絡があります。`
    )
    .setColor(0x00ffff) // Aqua
    .setTimestamp(startedAt);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`carpool|join|rid=${rideData.rideId}`)
      .setLabel('相乗り希望')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🙋‍♂️')
  );

  let message;
  if (rideData.carpoolMessageId) {
    message = await channel.messages.fetch(rideData.carpoolMessageId).catch(() => null);
    if (message) {
      await message.edit({ content, embeds: [embed], components: [row] });
    }
  }

  if (!message) {
    message = await channel.send({ content, embeds: [embed], components: [row] });

    // メッセージID保存
    rideData.carpoolMessageId = message.id;
    const activePath = `${paths.activeDispatchDir(guild.id)}/${rideData.rideId}.json`;
    await store.writeJson(activePath, rideData);

    // 運営者ログ用にも送信
    const { postOperatorLog } = require('../ログ/運営者ログ');
    await postOperatorLog({
      guild,
      content: `相乗り募集が開始されました！ [詳細はこちら](${message.url})`,
    }).catch(() => null);
  }
}

/**
 * 相乗り募集を締め切る
 */
async function stopCarpoolRecruitment(guild, rideData) {
  const config = await loadConfig(guild.id);
  const channelId = config.rideShareChannel;
  if (!channelId || !rideData.carpoolMessageId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const message = await channel.messages.fetch(rideData.carpoolMessageId).catch(() => null);
  if (!message) return;

  // 方面に紐付く地名リストを取得
  const areas = config.directionAreas?.[rideData.direction] || [];
  const areaInfo = areas.length > 0 ? `\n\n📍 **対応方面（${rideData.direction}）**\n${areas.join(' / ')}` : '';

  const embed = EmbedBuilder.from(message.embeds[0])
    .setTitle('⛔ 相乗り募集終了')
    .setColor(0x808080) // Gray
    .setDescription(
      message.embeds[0].description.split('\n\n🕒')[0] + // ルートと方面情報を維持
      `\n\n🕒 **この募集は締め切られました**\n\n` +
      `⚠️ **注意**\nすでに送迎が開始されているか、定員に達したため募集を終了しました。`
    )
    .setTimestamp();

  await message.edit({ content: '', embeds: [embed], components: [] }).catch(() => null);

  // データ更新
  rideData.carpoolMessageId = null;
  rideData.carpoolStatus = 'closed';
  const activePath = `${paths.activeDispatchDir(guild.id)}/${rideData.rideId}.json`;
  await store.writeJson(activePath, rideData);
}

module.exports = {
  postCarpoolRecruitment,
  stopCarpoolRecruitment,
  calculateRemainingCapacity,
};
