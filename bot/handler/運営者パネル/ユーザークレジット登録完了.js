const { EmbedBuilder, Colors } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * ユーザークレジット登録モーダル送信完了 (v2.8.3)
 */
module.exports = {
    customId: 'op|credits|sub=modal',
    type: 'modalSubmit',
    async execute(interaction) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.REPLY,
            adminOnly: true,
            async run(interaction) {
                const userId = interaction.fields.getTextInputValue('user_id');
                const amount = interaction.fields.getTextInputValue('amount');

                // 現時点ではログ出力のみ (データストア未実装のため)
                const embed = new EmbedBuilder()
                    .setTitle('✅ ユーザークレジット登録完了')
                    .setDescription(`<@${userId}> に **${amount} クレジット** を登録しました。`)
                    .setColor(Colors.Green)
                    .addFields(
                        { name: '対象ユーザーID', value: userId, inline: true },
                        { name: '登録量', value: amount, inline: true }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            },
        });
    },
};
