const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { loadConfig } = require('../../utils/設定/設定マネージャ');

/**
 * マッチング後の配車開始処理
 * チャンネル作成、ボタン送信、状態保存を行う
 */
async function startDispatch({ guild, driver, passenger, type, direction, count }) {
  const config = await loadConfig(guild.id);
  const categoryId = config.categories?.dispatch;

  // チャンネル名: 🚕-方面-名前
  const channelName = `🚕-${direction}-${passenger.username}`.slice(0, 32);

  // 権限設定
  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: driver.userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: passenger.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  // 管理者ロールがいれば追加
  if (config.roles?.admin) {
    permissionOverwrites.push({
      id: config.roles.admin,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId || null,
    permissionOverwrites,
  });

  // 配車中データ保存
  const dispatchId = `${Date.now()}_${driver.userId}_${guild.id}`;
  const dispatchData = {
    dispatchId,
    driverId: driver.userId,
    passengerId: passenger.id,
    passengerTag: passenger.tag,
    type,
    direction,
    count,
    channelId: channel.id,
    createdAt: new Date().toISOString(),
    status: 'matched',
  };

  const activePath = `${paths.activeDispatchDir(guild.id)}/${dispatchId}.json`;
  await store.writeJson(activePath, dispatchData);

  // チャンネル内メッセージ送信
  const embed = new EmbedBuilder()
    .setTitle('🚕 配車中（連絡用チャンネル）')
    .setDescription(
      `<@${passenger.id}> 様の配車が確定しました。\n担当ドライバー: <@${driver.userId}>`
    )
    .addFields(
      { name: '種別', value: type === 'cast' ? 'キャスト' : 'ゲスト', inline: true },
      { name: '方面', value: direction, inline: true },
      { name: '人数', value: `${count}人`, inline: true }
    )
    .setColor(0x00ff00);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=depart&did=${dispatchId}`)
      .setLabel('出発する')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`dispatch|order|sub=complete&did=${dispatchId}`)
      .setLabel('配送完了・帰庫')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true)
  );

  await channel.send({
    content: `担当ドライバー: <@${driver.userId}>\n依頼者: <@${passenger.id}>\n連絡はこちらで行ってください。`,
    embeds: [embed],
    components: [row],
  });

  return dispatchId;
}

module.exports = { startDispatch };
