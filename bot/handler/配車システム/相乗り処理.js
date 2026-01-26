// handler/配車システム/相乗り処理.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const { CarpoolStatus } = require('../../utils/constants');

/**
 * 相乗り募集の自動発動判定と送信
 */
async function handleCarpoolRecruitment(guild, leadUser, direction, count, dispatchId, dest) {
  const config = await loadConfig(guild.id);
  const carpoolChId = config.rideShareChannel;
  if (!carpoolChId) return;

  // 条件判定: 方面チェック
  if (!config.carpoolDirections?.includes(direction)) return;

  const channel = await guild.channels.fetch(carpoolChId).catch(() => null);
  if (!channel) return;

  // 相乗り募集データ保存
  const rideId = `${Date.now()}_${leadUser.id}_${guild.id}`;
  const carpoolData = {
    rideId,
    leadUserId: leadUser.id,
    dispatchId,
    direction: dest ? `${direction} / ${dest}` : direction,
    currentUsers: [{ userId: leadUser.id, count: parseInt(count) }],
    status: CarpoolStatus.RECRUITING,
    createdAt: new Date().toISOString(),
  };

  const cpPath = `${paths.carpoolDir(guild.id)}/${rideId}.json`;
  await store.writeJson(cpPath, carpoolData);

  const embed = buildPanelEmbed({
    title: '📢 相乗り募集',
    description: `現在、**${dest ? `${direction} / ${dest}` : direction}** 行きの便が手配されました。`,
    fields: [
      { name: '方面/目的地', value: dest ? `${direction} / ${dest}` : direction, inline: true },
      { name: '先発店舗', value: leadUser.username, inline: true },
      { name: '現在の乗員', value: `<@${leadUser.id}> (${count}名)`, inline: false },
      {
        name: '募集状況',
        value: '相乗り希望者は下のボタンを押してください。出発前であれば追加可能です。',
        inline: false,
      }
    ],
    type: 'info',
    client: guild.client
  });

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
