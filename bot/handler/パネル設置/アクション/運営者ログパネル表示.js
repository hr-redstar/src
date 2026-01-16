const {
    ChannelSelectMenuBuilder,
    ActionRowBuilder,
    ChannelType,
} = require('discord.js');

const {
    CUSTOM_ID,
    requireAdmin,
    MessageFlags,
} = require('../共通/_panelSetupCommon');

/**
 * 運営者ログ設定のチャンネル選択メニューを表示
 */
module.exports = {
    customId: CUSTOM_ID.SEND_OPERATOR_LOG_PANEL,
    type: 'button',
    async execute(interaction) {
        // ① 管理者チェック
        if (!(await requireAdmin(interaction))) return;

        // ② チャンネル選択メニュー作成
        const select = new ChannelSelectMenuBuilder()
            .setCustomId(CUSTOM_ID.SELECT_OPERATOR_LOG_CHANNEL)
            .setPlaceholder('運営者ログを送信するチャンネルを選択')
            .setChannelTypes(
                ChannelType.GuildText,
                ChannelType.GuildAnnouncement
            )
            .setMinValues(1)
            .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(select);

        // ③ 本人にしか見えないメッセージで送信
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const { loadConfig } = require('../../../utils/設定/設定マネージャ');
        const config = await loadConfig(interaction.guildId);
        let content = '📂 運営者ログを送信するチャンネルを選択してください。';
        if (config.logs?.operatorChannel || config.channels?.operatorLog) {
            const chId = config.channels?.operatorLog || config.logs?.operatorChannel;
            content = `⚠️ すでに <#${chId}> が通知先に設定されています。\n\n新しい通知先を選択してください：`;
        }

        await interaction.editReply({
            content,
            components: [row],
        });
    }
};
