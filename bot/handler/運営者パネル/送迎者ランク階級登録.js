const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { loadConfig } = require('../../utils/設定/設定マネージャ');

/**
 * 送迎者ランク階級登録 - モーダル表示
 */
module.exports = {
    customId: 'op|rank|sub=class_register',
    type: 'button',
    async execute(interaction) {
        return autoInteractionTemplate(interaction, {
            ack: 'none',
            adminOnly: true,
            async run(interaction) {
                const guildId = interaction.guildId;
                const config = await loadConfig(guildId);
                const currentRanks = config.driverRanks || [];
                const defaultText = currentRanks.join('\n');

                const modal = new ModalBuilder()
                    .setCustomId('op|rank|sub=modal')
                    .setTitle('送迎者ランク階級登録');

                const ranksInput = new TextInputBuilder()
                    .setCustomId('rank_names')
                    .setLabel('ランク階級（改行で複数登録、上から順に表示）')
                    .setPlaceholder('ブロンズ\nシルバー\nゴールド\nVIP')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(1000);

                if (defaultText) {
                    ranksInput.setValue(defaultText);
                }

                modal.addComponents(new ActionRowBuilder().addComponents(ranksInput));

                await interaction.showModal(modal);
            },
        });
    },
};
