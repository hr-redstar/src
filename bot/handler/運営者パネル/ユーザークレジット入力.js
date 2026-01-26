const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * ユーザークレジット登録 - 金額入力モーダル表示
 */
module.exports = {
    customId: 'op|credits|sub=user_select',
    type: 'stringSelect',
    async execute(interaction, client, parsed) {
        return autoInteractionTemplate(interaction, {
            ack: 'none',
            adminOnly: true,
            async run(interaction) {
                const targetUserId = interaction.values[0];
                const targetUser = await client.users.fetch(targetUserId).catch(() => null);
                const userName = targetUser ? targetUser.username : targetUserId;

                // 既存のクレジット情報を取得（もしあれば）
                const userPath = paths.userJson(interaction.guildId, targetUserId);
                const userData = await store.readJson(userPath, {}).catch(() => ({}));
                const currentCredits = userData.credits || 0;

                const modal = new ModalBuilder()
                    .setCustomId(`op|credits|sub=modal|uid=${targetUserId}`)
                    .setTitle(`${userName} のクレジット登録`);

                const amountInput = new TextInputBuilder()
                    .setCustomId('amount')
                    .setLabel('追加するクレジット量（数値を入力）')
                    .setPlaceholder(`現在の残高: ${currentCredits}`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(10);

                modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

                await interaction.showModal(modal);
            },
        });
    },
};
