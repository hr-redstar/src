const buildPanelEmbed = require('../../utils/embed/embedTemplate');
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

                // 取引履歴の記録 (v2.9.2)
                const { logCreditTransaction } = require('../../utils/creditHistoryStore');
                await logCreditTransaction(interaction.guildId, targetUserId, {
                    amount: amount,
                    type: 'charge',
                    reason: 'クレジットチャージ（管理者操作）',
                    balance: userData.credits
                }).catch(err => console.error('履歴記録エラー:', err));

                const embed = buildPanelEmbed({
                    title: '[管理] ユーザークレジット登録完了',
                    description: `<@${targetUserId}> に **${amount} クレジット** を追加しました。`,
                    fields: [
                        { name: '以前の残高', value: `${oldCredits}`, inline: true },
                        { name: '追加量', value: `+${amount}`, inline: true },
                        { name: '現在の残高', value: `${userData.credits}`, inline: true }
                    ],
                    type: 'success',
                    client
                });

                await interaction.editReply({ embeds: [embed] });
            },
        });
    },
};
