// command/01_自動設定パネル.js
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

/**
 * /自動設定パネル
 * 実行したチャンネルに「自動設定パネル」を送信する
 */
module.exports = {
    data: new SlashCommandBuilder()
        .setName('自動設定パネル')
        .setDescription('サーバーの各カテゴリー・チャンネルを一挙に自動構築するパネルを送信します（管理者用）')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    async execute(interaction) {
        const sendAutoSetupPanel = require('../handler/自動設定/自動設定パネル');
        return sendAutoSetupPanel(interaction);
    },
};
