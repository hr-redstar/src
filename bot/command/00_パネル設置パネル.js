// command/00_パネル設置パネル.js
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

/**
 * /パネル設置パネル
 * 実行したチャンネルに「パネル設置パネル」を送信する
 * ※ 送信処理は handler/パネル設置パネル/panel_パネル設置パネル.js に委譲
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('パネル設置パネル')
    .setDescription('パネル設置パネルを送信します（管理者用）')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    const sendPanelSetupPanel = require('../handler/パネル設置/メイン');
    return sendPanelSetupPanel(interaction);
  },
};
