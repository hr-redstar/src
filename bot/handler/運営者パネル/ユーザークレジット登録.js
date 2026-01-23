const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * ユーザークレジット登録 - モーダル表示 (v2.8.3)
 */
module.exports = {
    customId: 'op|credits|sub=start',
    type: 'button',
    async execute(interaction) {
        return autoInteractionTemplate(interaction, {
            ack: 'none',
            adminOnly: true,
            async run(interaction) {
                const modal = new ModalBuilder()
                    .setCustomId('op|credits|sub=modal')
                    .setTitle('ユーザークレジット登録');

                const userIdInput = new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('ユーザーID')
                    .setPlaceholder('123456789012345678')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const amountInput = new TextInputBuilder()
                    .setCustomId('amount')
                    .setLabel('登録クレジット量')
                    .setPlaceholder('1000')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(userIdInput),
                    new ActionRowBuilder().addComponents(amountInput)
                );

                await interaction.showModal(modal);
            },
        });
    },
};
