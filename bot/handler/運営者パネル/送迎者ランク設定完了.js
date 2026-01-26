const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 送迎者ランク設定完了 - データを保存
 */
module.exports = {
    customId: 'op|rank|sub=rank_select',
    type: 'selectMenu',
    async execute(interaction, client, parsed) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            adminOnly: true,
            async run(interaction) {
                const targetUserId = parsed?.params?.uid;
                const newRank = interaction.values[0];

                if (!targetUserId || !newRank) {
                    return interaction.editReply({
                        content: '❌ エラー: ユーザー情報の取得に失敗しました。',
                        embeds: [],
                        components: [],
                    });
                }

                // ユーザーデータを読み込み
                const userPath = paths.userJson(interaction.guildId, targetUserId);
                const userData = await store.readJson(userPath, { userId: targetUserId });

                // ランクを更新
                const oldRank = userData.driverRank || '未設定';
                userData.driverRank = newRank;

                // 保存
                await store.writeJson(userPath, userData);

                const embed = buildPanelEmbed({
                    title: '[管理] 送迎者ランク設定完了',
                    description: `<@${targetUserId}> のランクを更新しました。`,
                    fields: [
                        { name: '変更前', value: oldRank, inline: true },
                        { name: '変更後', value: newRank, inline: true }
                    ],
                    type: 'success',
                    client
                });

                await interaction.editReply({
                    embeds: [embed],
                    components: [],
                });
            },
        });
    },
};
