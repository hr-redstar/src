const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

/**
 * 問い合わせボタンの作成
 */
function buildInquiryButton() {
    return new ButtonBuilder()
        .setCustomId('inquiry|start')
        .setLabel('📩 問い合わせ')
        .setStyle(ButtonStyle.Secondary);
}

/**
 * パネルへボタンを追加する（ActionRowをパースして末尾に追加）
 * @param {import('discord.js').ActionRowBuilder[]} components 
 */
function addInquiryButtonToComponents(components) {
    const lastRow = components[components.length - 1];
    if (lastRow && lastRow.components.length < 5) {
        lastRow.addComponents(buildInquiryButton());
    } else {
        components.push(new ActionRowBuilder().addComponents(buildInquiryButton()));
    }
    return components;
}

module.exports = {
    buildInquiryButton,
    addInquiryButtonToComponents,
};
