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
        panelKey: 'ratingRank',
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

            // 3. 統計データ (v2.9.2 新機能: ピーク時間分析)
            const { getStats } = require('../../../utils/ストレージ/統計ストア');
            const stats = await getStats(guildId);

            // ピーク時間の計算 (直近1週間の時次データから集計)
            const hourlyStats = stats.hourly || {};
            const hourCounts = {}; // { "HH:00": count }

            Object.entries(hourlyStats).forEach(([key, val]) => {
                const hourPart = key.split(' ')[1]; // "HH:00"
                if (!hourCounts[hourPart]) hourCounts[hourPart] = 0;
                hourCounts[hourPart] += (val.ride_completed || 0) + (val.carpool_matched || 0);
            });

            const sortedHours = Object.entries(hourCounts)
                .sort((a, b) => b[1] - a.count)
                .slice(0, 3);

            const peakLines = sortedHours.map((h, i) => `${i + 1}. **${h[0]}** (${h[1]}件)`);
            const totalCarpool = stats.cumulative?.carpool_matched || 0;

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

            // 利用実績とインテリジェンス (v2.9.2)
            embed.addFields({
                name: '📊 運行インテリジェンス',
                value: [
                    `🔹 累計相乗り成立数: **${totalCarpool.toLocaleString()}** 件`,
                    '**🕐 ピーク時間帯 (TOP 3):**',
                    peakLines.join('\n') || 'データ収集中...',
                    '※直近1週間の傾向から算出しています。'
                ].join('\n'),
                inline: false
            });

            // クレジットサマリー
            const creditTopLines = topCredits.map((u, i) => `${i + 1}. ${u.current?.storeName || u.userId.substring(0, 8)}...: ￥${(u.credits || 0).toLocaleString()}`);
            const creditLowLines = lowCredits.map((u, i) => `⚠ ${LOW_CREDIT_ICON(u.credits)} ${u.current?.storeName || u.userId.substring(0, 8)}...: ￥${(u.credits || 0).toLocaleString()}`);

            function LOW_CREDIT_ICON(credits) {
                if (credits < 0) return '🔴';
                if (credits < 500) return '🟡';
                return '⚪';
            }

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
