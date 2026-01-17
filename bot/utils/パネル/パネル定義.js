const { EmbedBuilder } = require('discord.js');

function chLink(id) {
  return id ? `<#${id}>` : '未設定';
}
function roleMentions(ids) {
  return ids?.length ? ids.map((r) => `<@&${r}>`).join(' ') : '未設定';
}
function msgLink(guildId, channelId, messageId) {
  if (!guildId || !channelId || !messageId) return '未設定';
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function adminEmbed(guild, cfg) {
  const dp = cfg.panels.driverPanel;
  const driverPanelLink =
    dp.channelId && dp.messageId
      ? `${chLink(dp.channelId)}\n${msgLink(guild.id, dp.channelId, dp.messageId)}`
      : '未設定';

  return new EmbedBuilder()
    .setTitle('管理者パネル')
    .setDescription('各種設定を登録します（変更はGCSへ保存）')
    .addFields(
      { name: '送迎者ロール', value: roleMentions(cfg.roles.driver), inline: false },
      { name: '利用者ロール', value: roleMentions(cfg.roles.user), inline: false },

      { name: 'グローバルログ', value: chLink(cfg.channels.globalLogChannelId), inline: true },
      { name: '管理者ログチャンネル', value: chLink(cfg.channels.adminLogChannelId), inline: true },

      {
        name: '運営者用ログスレッド',
        value: cfg.adminLog.threadId ? `<#${cfg.adminLog.threadId}>` : '未作成',
        inline: false,
      },

      { name: '送迎者パネル', value: driverPanelLink, inline: false },

      { name: '相乗りチャンネル', value: chLink(cfg.channels.rideShareChannelId), inline: false }
    );
}

function driverPanelEmbed(driverCount = 0) {
  return new EmbedBuilder()
    .setTitle('送迎者パネル')
    .setDescription('送迎者の操作パネルです')
    .addFields({
      name: '送迎者数',
      value: `${driverCount}人（今から行けます を押している送迎者人数）`,
      inline: false,
    });
}

module.exports = { adminEmbed, driverPanelEmbed, msgLink };
