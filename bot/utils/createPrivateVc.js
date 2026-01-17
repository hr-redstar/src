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

  // VC名: MM/DD MatchTime~--:--【送迎者現在地】→【住所・目印】→【目的地】
  // ※送迎者現在地は動的などのため、初期は簡易表示にするか、もしくは仕様通り「MM/DD MatchTime~--:--...」とする
  // 仕様: MM/DD 21:00~--:--【送迎者現在地】→【住所・目印】→【目的地】
  //   「送迎者現在地」は引数にない場合があるが、pickupLocation (出発点) のことか？
  //   仕様書には「送迎者現在地」とあるが、マッチング時は不明なことが多い。
  //   とりあえず仕様書例のフォーマットに近づける。
  //   pickupLocation = 住所・目印 (ユーザーの現在地)
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
  const embed = new EmbedBuilder()
    .setTitle(channelName)
    .setDescription(
      `送迎者：<@${driver.id}>\n利用者：<@${user.id}>\n\n` +
        `**マッチング時間**：${matchTime}\n` +
        `**向かっています**：--:--`
    )
    .addFields(
      { name: '送迎者', value: '送迎開始時間：--:--\n送迎終了時間：--:--', inline: true },
      { name: '利用者', value: '送迎開始時間：--:--\n送迎終了時間：--:--', inline: true }
    )
    .setColor(0x3498db)
    .setFooter({ text: 'ボタンを押して進行状況を更新してください' });

  // ボタン作成
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ride|approach|rid=${rideId}`)
      .setLabel('向かっています')
      .setStyle(ButtonStyle.Primary), // 送迎者のみ
    new ButtonBuilder()
      .setCustomId(`ride|start|rid=${rideId}`)
      .setLabel('送迎開始')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`ride|end|rid=${rideId}`)
      .setLabel('送迎終了')
      .setStyle(ButtonStyle.Danger)
  );

  // Initial Message
  await vc.send({
    content: `<@${driver.id}> <@${user.id}> 送迎マッチングしました！`,
    embeds: [embed],
    components: [row],
  });

  return vc;
};
