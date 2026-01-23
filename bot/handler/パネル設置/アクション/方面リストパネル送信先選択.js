// src/bot/handler/パネル設置/アクション/方面リストパネル送信先選択.js
const { CUSTOM_ID } = require('../共通/_panelSetupCommon');
const panelSetupHelper = require('./パネル送信ヘルパー');
const { buildDirectionsPanelMessage } = require('../../管理者パネル/方面リストパネル');

module.exports = {
    customId: CUSTOM_ID.SELECT_DIRECTIONS_PANEL_CHANNEL,
    async execute(interaction, client, parsed) {
        return panelSetupHelper.handleChannelSelect(interaction, {
            panelKey: 'directions',
            panelName: '方面リスト設定パネル',
            buildMessage: (guild) => buildDirectionsPanelMessage(guild),
        });
    },
};
