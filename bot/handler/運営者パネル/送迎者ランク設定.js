const {
    ActionRowBuilder,
    UserSelectMenuBuilder,
    EmbedBuilder,
    Colors,
} = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 送迎者ランク設定 - ユーザー選択メニューを表示
 */
module.exports = {
    customId: 'op|rank|sub=assignment_start',
    type: 'button',
    async execute(interaction, client, parsed) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            adminOnly: true,
            async run(interaction) {
                const embed = new EmbedBuilder()
                    .setTitle('🎖️ 送迎者ランク設定')
                    .setDescription('ランクを設定したい送迎者（ユーザー）を選択してください。')
                    .setColor(Colors.Gold)
                    .setTimestamp();

                const selectMenu = new UserSelectMenuBuilder()
                    .setCustomId('op|rank|sub=user_select')
                    .setPlaceholder('送迎者を選択してください')
                    .setMinValues(1)
                    .setMaxValues(1);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                await interaction.editReply({
                    embeds: [embed],
                    components: [row],
                });
            },
        });
    },
};
