const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 相乗り募集の自動発動判定と送信
 */
async function handleCarpoolRecruitment(guild, leadUser, direction, count, dispatchId) {
  const config = await loadConfig(guild.id);
  const carpoolChId = config.rideShareChannel;
  if (!carpoolChId) return;

  // 条件判定: 方面チェック
  if (!config.carpoolDirections?.includes(direction)) return;

  const channel = await guild.channels.fetch(carpoolChId).catch(() => null);
  if (!channel) return;

  // 相乗り募集データ保存
  const rideId = `cp_${Date.now()}`;
  const carpoolData = {
    rideId,
    leadUserId: leadUser.id,
    dispatchId, // 紐付け
    direction,
    currentUsers: [{ userId: leadUser.id, count: parseInt(count) }],
    status: 'recruiting',
    createdAt: new Date().toISOString(),
  };

  const cpPath = `${paths.carpoolDir(guild.id)}/${rideId}.json`;
  await store.writeJson(cpPath, carpoolData);

  const embed = new EmbedBuilder()
    .setTitle('📢 相乗り募集')
    .setDescription(`現在、**${direction}** 行きの便が手配されました。`)
    .addFields(
      { name: '方面', value: direction, inline: true },
      { name: '先発店舗', value: leadUser.username, inline: true },
      { name: '現在の乗員', value: `<@${leadUser.id}> (${count}名)`, inline: false },
      {
        name: '募集状況',
        value: '相乗り希望者は下のボタンを押してください。出発前であれば追加可能です。',
        inline: false,
      }
    )
    .setColor(0x3498db)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=carpool_join&rid=${rideId}`)
      .setLabel('相乗りを希望する')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=carpool_cancel&rid=${rideId}`)
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Secondary)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  // メッセージIDを保存
  carpoolData.messageId = msg.id;
  carpoolData.channelId = channel.id;
  await store.writeJson(cpPath, carpoolData);
}

module.exports = { handleCarpoolRecruitment };
