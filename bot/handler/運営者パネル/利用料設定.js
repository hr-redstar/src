const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { loadConfig } = require('../../utils/設定/設定マネージャ');

/**
 * 利用料設定 - モーダル表示
 */
module.exports = {
    customId: 'op|fee|sub=setting',
    type: 'button',
    async execute(interaction, client, parsed) {
        return autoInteractionTemplate(interaction, {
            ack: 'none',
            adminOnly: true,
            async run(interaction) {
                const guildId = interaction.guildId;
                const config = await loadConfig(guildId);
                const currentFee = config.usageFee || '';

                const modal = new ModalBuilder()
                    .setCustomId('op|fee|sub=modal')
                    .setTitle('利用料の設定');

                const feeInput = new TextInputBuilder()
                    .setCustomId('usage_fee')
                    .setLabel('利用料（例：1,000円 / 1km 200円 など）')
                    .setPlaceholder('送迎の基本料金や計算式を入力してください')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(100);

                if (currentFee) {
                    feeInput.setValue(currentFee);
                }

                modal.addComponents(new ActionRowBuilder().addComponents(feeInput));

                await interaction.showModal(modal);
            },
        });
    },
};
