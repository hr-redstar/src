const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

module.exports.createPrivateVc = async ({
  guild,
  driver,
  user,
  categoryId,
  rideId,
  pickupLocation,
  destination,
  userMark,
}) => {
  if (!categoryId) return null;

  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const matchTime = `${hh}:${min}`;

  // VC名: MM/DD MatchTime~--:--【送迎者現在地】→【方面】→【目的地】
  // ※送迎者現在地は動的などのため、初期は簡易表示にするか、もしくは仕様通り「MM/DD MatchTime~--:--...」とする
  // 仕様: MM/DD 21:00~--:--【送迎者現在地】→【方面】→【目的地】
  //   「送迎者現在地」は引数にない場合があるが、pickupLocation (出発点) のことか？
  //   仕様書には「送迎者現在地」とあるが、マッチング時は不明なことが多い。
  //   とりあえず仕様書例のフォーマットに近づける。
  //   pickupLocation = 方面 (ユーザーの現在地)
  //   destination = 目的地

  // VC名の長さ制限(100文字)に注意
  const baseName = `${mm}/${dd} ${matchTime}~--:--`;
  const routeInfo = `【${driver.username}】→【${userMark || pickupLocation}】→【${destination}】`;
  // ※送迎者現在地≒Driver名で代用、または省略。仕様書の「送迎者現在地」は送迎者が入力する場所だが、ここではDriver名を入れておくのが無難か。
  // ユーザーリクエスト: "VC名：月日　マッチング時間~送迎終了時間【送迎者現在地】→【住所・目印】→【目的地】"
  // ここでは送迎者の現在地はデータとして持っていない可能性が高い。
  // "送迎者"としておきます。

  let channelName = `${baseName}${routeInfo}`;
  if (channelName.length > 100) {
    channelName = channelName.substring(0, 100);
  }

  const vc = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildVoice,
    parent: categoryId,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: driver.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      },
    ],
  });

  // 初期Embed作成
  const buildPanelEmbed = require('./embed/embedTemplate');
  const embed = buildPanelEmbed({
    title: channelName,
    description: [
      `送迎者：<@${driver.id}>`,
      `利用者：<@${user.id}>`,
      '',
      `**マッチング時間**：${matchTime}`,
      `**向かっています**：--:--`
    ].join('\n'),
    fields: [
      { name: '送迎者', value: '送迎開始時間：--:--\n送迎終了時間：--:--', inline: true },
      { name: '利用者', value: '送迎開始時間：--:--\n送迎終了時間：--:--', inline: true }
    ],
    type: 'info',
    client: guild.client
  });

  // ボタン作成 (3列構成 - v2.9.2 Professional Layout)
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ride|approach|rid=${rideId}`)
      .setLabel('向かっています')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`ride|start|rid=${rideId}`)
      .setLabel('送迎開始')
      .setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ride|carpool_approach|rid=${rideId}`)
      .setLabel('相乗り合流場所へ向かっています')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ride|carpool_start|rid=${rideId}`)
      .setLabel('相乗り者送迎開始')
      .setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ride|carpool_end|rid=${rideId}`)
      .setLabel('相乗り送迎終了')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ride|end|rid=${rideId}`)
      .setLabel('送迎終了')
      .setStyle(ButtonStyle.Danger)
  );

  // Initial Message
  await vc.send({
    content: `<@${driver.id}> <@${user.id}> 送迎マッチングしました！`,
    embeds: [embed],
    components: [row1, row2, row3],
  });

  return vc;
};
