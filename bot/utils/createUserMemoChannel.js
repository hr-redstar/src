const { ChannelType, PermissionFlagsBits } = require('discord.js');

/**
 * ユーザーメモ用プライベートテキストチャンネル作成
 * @param {Object} options
 * @param {Guild} options.guild - ギルド
 * @param {User} options.user - 対象ユーザー
 * @param {string} options.categoryId - カテゴリーID
 * @param {string} options.role - 役割 ('driver' または 'user')
 * @param {Object} options.registrationData - 登録データ（オプション）
 */
module.exports.createUserMemoChannel = async ({
  guild,
  user,
  categoryId,
  role = 'user',
  registrationData = null,
}) => {
  // チャンネル名生成（ニックネーム優先）
  const { buildUserMemoChannelName } = require('./buildUserMemoChannelName');
  const member = await guild.members.fetch(user.id).catch(() => null);
  const channelName = member ? buildUserMemoChannelName(member) : `ユーザーメモ｜${user.username}`;

  // Config取得（運営者ロールID取得用）
  const { loadConfig } = require('./設定/設定マネージャ');
  const config = await loadConfig(guild.id);
  const adminRoleId = config.roles?.admin;

  // 権限設定の構築
  const permissionOverwrites = [
    // 全体拒否
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    // 本人
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    // Bot
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  // 運営者ロールが設定されていれば追加
  if (adminRoleId) {
    permissionOverwrites.push({
      id: adminRoleId,
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
    parent: categoryId,
    topic: require('./buildUserMemoTopic').buildUserMemoTopic(user.id),
    permissionOverwrites,
  });

  // スレッド作成オプションEmbedを送信
  const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
  } = require('discord.js');

  const threadEmbed = new EmbedBuilder()
    .setTitle('📁 履歴メモの整理（スレッド化）について')
    .setDescription(
      'メモ履歴が増えた場合、\n' +
      'このメモチャンネルを見やすく保つため\n' +
      '履歴をスレッドにまとめることができます。\n\n' +
      '**■ 選択可能な期間**\n' +
      '・1週間\n' +
      '・2週間\n' +
      '・1か月\n' +
      '・半年\n\n' +
      '※ 選択がない場合、スレッドは作成されません\n' +
      '※ この設定は再登録時に変更可能です'
    )
    .setColor(0x95a5a6)
    .setFooter({ text: '設定は登録時の選択内容に基づいて自動処理されます' });

  // Select Menu作成
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('memo|threadpolicy|sub=select')
    .setPlaceholder('履歴メモの整理')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('スレッド作成しない')
        .setValue('none')
        .setDescription('履歴はすべてメインチャンネルに追記されます')
        .setDefault(true),
      new StringSelectMenuOptionBuilder()
        .setLabel('1週間ごと')
        .setValue('1w')
        .setDescription('1週間ごとに新しいスレッドを作成'),
      new StringSelectMenuOptionBuilder()
        .setLabel('2週間ごと')
        .setValue('2w')
        .setDescription('2週間ごとに新しいスレッドを作成'),
      new StringSelectMenuOptionBuilder()
        .setLabel('1か月ごと')
        .setValue('1m')
        .setDescription('1か月ごとに新しいスレッドを作成'),
      new StringSelectMenuOptionBuilder()
        .setLabel('半年ごと')
        .setValue('6m')
        .setDescription('半年ごとに新しいスレッドを作成')
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);
  await channel.send({ embeds: [threadEmbed], components: [row] });

  return channel;
};
