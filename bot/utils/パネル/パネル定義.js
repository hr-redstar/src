const buildPanelEmbed = require('../embed/embedTemplate');

function adminEmbed(guild, cfg) {
  const dp = cfg.panels.driverPanel;
  const driverPanelLink =
    dp.channelId && dp.messageId
      ? `${chLink(dp.channelId)}\n${msgLink(guild.id, dp.channelId, dp.messageId)}`
      : '未設定';

  return buildPanelEmbed({
    title: '管理者パネル',
    description: '各種設定を登録します（変更はGCSへ保存）',
    fields: [
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
    ],
    type: 'info',
    client: guild.client
  });
}

function driverPanelEmbed(client, driverCount = 0) {
  return buildPanelEmbed({
    title: '送迎者パネル',
    description: '送迎者の操作パネルです',
    fields: [
      {
        name: '送迎者数',
        value: `${driverCount}人（今から行けます を押している送迎者人数）`,
        inline: false,
      }
    ],
    type: 'info',
    client
  });
}

module.exports = { adminEmbed, driverPanelEmbed, msgLink };
