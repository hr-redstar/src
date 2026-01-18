const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildRanking } = require('./集計ロジック');
const autoInteractionTemplate = require('../../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const buildPanelEmbed = require('../../../../utils/embed/embedTemplate');

/**
 * 統計ダッシュボード（ランキング）ハンドラー
 */
async function showDashboard(interaction) {
    return autoInteractionTemplate(interaction, {
        adminOnly: true,
        ack: ACK.AUTO,
        async run(interaction) {
            const guildId = interaction.guildId;

            // 送迎者ランキング取得
            const driverRanking = await getGuildRanking(guildId, 'driver');
            // 利用者ランキング取得
            const userRanking = await getGuildRanking(guildId, 'user');

            const embed = buildPanelEmbed({
                title: '📈 統計ダッシュボード（ランキング）',
                description: '平均点と送迎件数に基づくトップユーザーのリストです。',
                color: 0xffd700,
                client: interaction.client
            });

            // 送迎者ランキング文字列作成
            const driverLines = driverRanking.slice(0, 5).map((r, i) => {
                const stars = '⭐'.repeat(Math.round(r.average));
                return `${i + 1}. <@${r.userId}> (**${r.average}** ${stars} / ${r.count}件)`;
            });
            embed.addFields({
                name: '🚗 送迎者ランキング (TOP 5)',
                value: driverLines.join('\n') || 'データなし',
                inline: false
            });

            // 利用者ランキング文字列作成
            const userLines = userRanking.slice(0, 5).map((r, i) => {
                const stars = '⭐'.repeat(Math.round(r.average));
                return `${i + 1}. <@${r.userId}> (**${r.average}** ${stars} / ${r.count}件)`;
            });
            embed.addFields({
                name: '👤 利用者ランキング (TOP 5)',
                value: userLines.join('\n') || 'データなし',
                inline: false
            });

            await interaction.editReply({
                embeds: [embed],
            });
        }
    });
}

module.exports = { showDashboard };
