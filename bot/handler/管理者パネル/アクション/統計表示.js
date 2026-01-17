// src/bot/handler/管理者パネル/アクション/統計表示.js
const { EmbedBuilder } = require('discord.js');
const { getStats } = require('../../../utils/ストレージ/統計ストア');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 統計ダッシュボードの表示
 */
async function execute(interaction, parsed) {
    return autoInteractionTemplate(interaction, {
        adminOnly: true,
        ack: ACK.REPLY,
        async run(interaction) {
            const guildId = interaction.guildId;
            const stats = await getStats(guildId);

            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const ym = `${y}-${m}`;
            const ymd = `${y}-${m}-${d}`;

            const daily = stats.daily[ymd] || {};
            const monthly = stats.monthly[ym] || {};
            const total = stats.cumulative || {};

            const embed = new EmbedBuilder()
                .setTitle('📊 稼働統計ダッシュボード')
                .setDescription(`ギルドID: ${guildId}\n集計日時: ${now.toLocaleString('ja-JP')}`)
                .setColor(0x3498db)
                .addFields(
                    {
                        name: '📅 本日の稼働 (Daily)',
                        value: [
                            `✅ 送迎完了: **${daily.ride_completed || 0}** 件`,
                            `🤝 相乗り参加: **${daily.carpool_joined || 0}** 名`,
                            `👤 新規利用者: **${daily.user_registered || 0}** 名`,
                            `🚗 新規送迎者: **${daily.driver_registered || 0}** 名`,
                        ].join('\n'),
                        inline: false,
                    },
                    {
                        name: '🗓️ 今月の累計 (Monthly)',
                        value: [
                            `✅ 送迎完了: **${monthly.ride_completed || 0}** 件`,
                            `マッチング: **${monthly.ride_matched || 0}** 件`,
                            `累計利用者登録: **${monthly.user_registered || 0}** 名`,
                        ].join('\n'),
                        inline: true,
                    },
                    {
                        name: '📈 全期間累計 (Total)',
                        value: [
                            `✅ 送迎完了: **${total.ride_completed || 0}** 件`,
                            `🤝 相乗り累計: **${total.carpool_joined || 0}** 名`,
                        ].join('\n'),
                        inline: true,
                    }
                )
                .setFooter({ text: '統計データはイベント発生時にリアルタイムで更新されます。' })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                ephemeral: true,
            });
        },
    });
}

module.exports = { execute };
