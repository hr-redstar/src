const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildRanking } = require('./集計ロジック');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const buildPanelEmbed = require('../../../utils/embed/embedTemplate');

/**
 * 統計ダッシュボード（ランキング）ハンドラー
 */
async function showDashboard(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
        adminOnly: true,
        ack: ACK.AUTO,
        async run(interaction) {
            const guildId = interaction.guildId;
            const store = require('../../../utils/ストレージ/ストア共通');
            const config = (await require('../../../utils/設定/設定マネージャ').loadConfig(guildId)) || {};
            const userRanks = config.ranks?.userRanks || {};

            // 1. 各種ランキング取得
            const driverRanking = await getGuildRanking(guildId, 'driver');
            const userRanking = await getGuildRanking(guildId, 'user');

            // 2. 利用者クレジット集計
            const allUsers = await store.loadUsers(guildId).catch(() => []);
            const sortedByCredit = [...allUsers]
                .filter(u => u.credits !== undefined)
                .sort((a, b) => b.credits - a.credits);

            const topCredits = sortedByCredit.slice(0, 5);
            const lowCredits = sortedByCredit.slice(-5).reverse();
            const totalCreditUnits = sortedByCredit.reduce((sum, u) => sum + (u.credits || 0), 0);

            const embed = buildPanelEmbed({
                title: '📈 運営・管理ダッシュボード',
                description: 'システムの稼働状況、実績、および資産残高を一括表示します。',
                color: 0xffd700,
                client: interaction.client
            });

            // 送迎者ランキング
            const driverLines = driverRanking.slice(0, 5).map((r, i) => {
                const rank = userRanks[r.userId] ? `[${userRanks[r.userId]}] ` : '';
                return `${i + 1}. ${rank}${r.nickname || '不明'} (${r.average}★ / ${r.count}件)`;
            });
            embed.addFields({
                name: '🚗 送迎者実績ランキング (TOP 5)',
                value: `\`\`\`\n${driverLines.join('\n') || 'データなし'}\n\`\`\``,
                inline: false
            });

            // クレジットサマリー
            const creditTopLines = topCredits.map((u, i) => `${i + 1}. ${u.current?.storeName || u.userId.substring(0, 8)}...: ￥${(u.credits || 0).toLocaleString()}`);
            const creditLowLines = lowCredits.map((u, i) => `⚠ ${u.current?.storeName || u.userId.substring(0, 8)}...: ￥${(u.credits || 0).toLocaleString()}`);

            embed.addFields({
                name: '💰 利用者クレジット状況',
                value: [
                    '**上位残高:**',
                    `\`\`\`\n${creditTopLines.join('\n') || 'データなし'}\n\`\`\``,
                    '**不足・注意:**',
                    `\`\`\`\n${creditLowLines.join('\n') || 'データなし'}\n\`\`\``,
                    `▫️ システム総資高: **￥${totalCreditUnits.toLocaleString()}**`
                ].join('\n'),
                inline: false
            });

            await interaction.editReply({
                embeds: [embed],
            });
        }
    });
}

module.exports = { showDashboard };
