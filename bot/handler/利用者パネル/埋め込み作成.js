const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');

/**
 * 利用者パネルの埋め込みを生成
 */
function buildUserPanelEmbed(guild, rideCount = 0, client) {
  const botClient = client || guild.client;
  return buildPanelEmbed({
    title: '利用者パネル',
    description: `
現在の送迎車： **${rideCount}** 台
自分・ゲストの送迎依頼ができます
    `,
    client: botClient,
  });
}

/**
 * 利用者パネルのボタンを生成
 */
function buildUserPanelComponents() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('user|ride|sub=request')
      .setLabel('配車依頼')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('user|ride|sub=guest')
      .setLabel('ゲスト送迎依頼')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('user|check')
      .setLabel('登録状態確認')
      .setStyle(ButtonStyle.Success)
  );
  return [row];
}

/**
 * 利用者パネルのメッセージペイロードを生成
 */
function buildUserPanelMessage(guild, rideCount = 0, client) {
  const botClient = client || guild.client;
  const embed = buildUserPanelEmbed(guild, rideCount, botClient);
  const components = buildUserPanelComponents();
  return buildPanelMessage({ embed, components });
}

module.exports = {
  buildUserPanelEmbed,
  buildUserPanelComponents,
  buildUserPanelMessage,
};
