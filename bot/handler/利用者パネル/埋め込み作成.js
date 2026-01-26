const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');

/**
 * 利用者パネルの埋め込みを生成
 */
function buildUserPanelEmbed(guild, driverCount = 0, client) {
  const botClient = client || guild.client;

  return buildPanelEmbed({
    title: '利用者パネル',
    description: [
      '自分やゲストの送迎依頼を出すことができます。',
      '',
      `現在稼働中の送迎車: **${driverCount}** 台`,
      '※「配車依頼」ボタンから自動的にマッチングが開始されます。'
    ].join('\n'),
    client: botClient,
  });
}

const { addInquiryButtonToComponents } = require('../共通/InquiryPanel');

/**
 * 利用者パネルのボタンを生成
 */
function buildUserPanelComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('dispatch|order|sub=direction&type=cast')
      .setLabel('配車依頼')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('dispatch|order|sub=guest_modal&type=guest')
      .setLabel('ゲスト送迎依頼')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('reg|user|sub=check')
      .setLabel('登録状態確認')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('user|credits|sub=history')
      .setEmoji('💳')
      .setLabel('残高履歴')
      .setStyle(ButtonStyle.Secondary)
  );

  const components = [row1, row2];
  return addInquiryButtonToComponents(components);
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
