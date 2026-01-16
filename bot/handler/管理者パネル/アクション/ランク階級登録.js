const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const interactionTemplate = require("../../共通/interactionTemplate");
const { ACK } = interactionTemplate;
const { saveRanks } = require('../../../utils/ranksStore');

module.exports = {
    customId: 'admin:btn:register_rank_tiers_start', // パネルのボタンID
    type: 'button',
    async execute(interaction) {
        // モーダルを表示
        const modal = new ModalBuilder()
            .setCustomId('admin:modal:register_rank_tiers')
            .setTitle('ランク階級登録');

        const input = new TextInputBuilder()
            .setCustomId('ranks_input')
            .setLabel('ランク名を入力（改行で複数）')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('ゴールド\nシルバー\nブロンズ')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }
};

/**
 * モーダル送信時の処理 (handler.js等からルーティングされる想定)
 */
module.exports.handleModal = async function (interaction) {
    return interactionTemplate(interaction, {
        ack: ACK.REPLY,
        adminOnly: true,
        async run(interaction) {
            const text = interaction.fields.getTextInputValue('ranks_input');
            const ranks = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

            if (ranks.length === 0) {
                return interaction.editReply({ content: '❌ 有効なランク名が入力されませんでした。' });
            }

            await saveRanks(interaction.guildId, ranks);

            await interaction.editReply({
                content: `✅ 以下のランク階級を登録しました：\n${ranks.map(r => `・${r}`).join('\n')}`
            });
        }
    });
};
