const {
    ActionRowBuilder,
    UserSelectMenuBuilder,
    EmbedBuilder,
    Colors,
} = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * ユーザークレジット登録 - ユーザー選択メニューを表示
 */
module.exports = {
    customId: 'op|credits|sub=start',
    type: 'button',
    async execute(interaction, client, parsed) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            adminOnly: true,
            async run(interaction) {
                const embed = new EmbedBuilder()
                    .setTitle('💰 ユーザークレジット設定')
                    .setDescription('クレジットを登録（または変更）したい利用者を選択してください。')
                    .setColor(Colors.Gold)
                    .setTimestamp();

                const selectMenu = new UserSelectMenuBuilder()
                    .setCustomId('op|credits|sub=user_select')
                    .setPlaceholder('ユーザーを選択してください')
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
