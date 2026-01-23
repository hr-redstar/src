const { buildBasePanelEmbed } = require('../共通/Embedテンプレート');
const { CUSTOM_ID } = require('./共通/_panelSetupCommon');
const { Colors } = require('discord.js');

/**
 * 各パネルの設置行を生成する
 */
function panelLine(guildId, label, data) {
  if (!data || !data.channelId || !data.messageId) {
    return `**${label}**\n⚠️ 未設置`;
  }
  // テキストチャンネルリンク + パネルメッセージリンク
  const channelLink = `<#${data.channelId}>`;
  const messageLink = `[パネルメッセージ](https://discord.com/channels/${guildId}/${data.channelId}/${data.messageId})`;
  return `**${label}**\n${channelLink} ${messageLink}`;
}

/**
 * パネル設置パネルの埋め込みを作成
 */
module.exports = function buildPanelSetupEmbed(config, guildId, client) {
  const panels = config.panels ?? {};

  const lines = [
    panelLine(guildId, '管理者パネル', panels.admin),
    panelLine(guildId, '運営者パネル', panels.operatorPanel),
    panelLine(guildId, '送迎者パネル', panels.driverPanel),
    panelLine(guildId, '利用者パネル', panels.userPanel),
    panelLine(guildId, '送迎者登録パネル', panels.driverRegister),
    panelLine(guildId, '利用者登録パネル', panels.userRegister),
    panelLine(guildId, 'ユーザー確認パネル', panels.userCheckPanel),
    panelLine(guildId, '送迎一覧パネル', panels.rideList),
    panelLine(guildId, '案内パネル', panels.guide),
    panelLine(guildId, '口コミランクパネル', panels.ratingRank),
  ];

  return buildBasePanelEmbed({
    title: 'パネル設置パネル',
    description: lines.join('\n\n'),
    botName: client.user.username,
  })
    .setColor(Colors.Blue) // Discord Blue
    .setTimestamp();
};
