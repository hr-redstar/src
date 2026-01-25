const { EmbedBuilder, Colors } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * ユーザークレジット登録完了 - データを永続化
 */
module.exports = {
    customId: 'op|credits|sub=modal',
    type: 'modalSubmit',
    async execute(interaction, client, parsed) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            adminOnly: true,
            async run(interaction) {
                const targetUserId = parsed?.params?.uid;
                const amountInput = interaction.fields.getTextInputValue('amount');
                const amount = parseInt(amountInput);

                if (isNaN(amount)) {
                    return interaction.editReply({
                        content: '❌ クレジット量は数値で入力してください。',
                    });
                }

                // ユーザーデータを読み込み
                const userPath = paths.userJson(interaction.guildId, targetUserId);
                const userData = await store.readJson(userPath, { userId: targetUserId });

                // クレジットを加算
                const oldCredits = userData.credits || 0;
                userData.credits = (userData.credits || 0) + amount;

                // 保存
                await store.writeJson(userPath, userData);

                const embed = new EmbedBuilder()
                    .setTitle('✅ ユーザークレジット登録完了')
                    .setDescription(`<@${targetUserId}> に **${amount} クレジット** を追加しました。`)
                    .addFields(
                        { name: '以前の残高', value: `${oldCredits}`, inline: true },
                        { name: '追加量', value: `+${amount}`, inline: true },
                        { name: '現在の残高', value: `${userData.credits}`, inline: true }
                    )
                    .setColor(Colors.Green)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            },
        });
    },
};
