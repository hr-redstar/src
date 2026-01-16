const { ActionRowBuilder, UserSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const interactionTemplate = require("../../共通/interactionTemplate");
const { ACK } = interactionTemplate;
const { getRatingSummary } = require('../../../utils/ratingsStore');
const { loadDriver } = require('../../../utils/driversStore');
const { loadUser } = require('../../../utils/usersStore');

module.exports = {
    customId: 'admin:btn:rating_check_start',
    type: 'button',
    async execute(interaction) {
        return interactionTemplate(interaction, {
            ack: ACK.REPLY,
            adminOnly: true,
            async run(interaction) {
                // ユーザー選択メニューを表示
                const select = new UserSelectMenuBuilder()
                    .setCustomId('admin:rating_check:user_select')
                    .setPlaceholder('口コミを確認したいユーザーを選択')
                    .setMaxValues(1);

                const row = new ActionRowBuilder().addComponents(select);

                await interaction.editReply({
                    content: '口コミ・評価を確認するユーザーを選択してください。',
                    components: [row]
                });
            }
        });
    }
};

/**
 * ユーザー選択時の処理
 */
module.exports.handleUserSelect = async function (interaction) {
    return interactionTemplate(interaction, {
        ack: ACK.UPDATE,
        adminOnly: true,
        async run(interaction) {
            const userId = interaction.values[0];
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            const user = member ? member.user : await interaction.client.users.fetch(userId).catch(() => null);

            // 役割判定（送迎者優先、なければ利用者）
            let role = 'driver';
            let profile = await loadDriver(interaction.guildId, userId);

            if (!profile) {
                role = 'user';
                profile = await loadUser(interaction.guildId, userId);
            }

            if (!profile) {
                return interaction.editReply({
                    content: `❌ このユーザー（${user ? user.tag : userId}）は送迎者・利用者として登録されていません。`,
                    components: []
                });
            }

            // データ取得
            const summary = await getRatingSummary(interaction.guildId, userId, role);

            // Embed作成
            const embed = buildRatingSummaryEmbed(user, role, summary);

            // コメント確認ボタン
            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`admin:rating_check:comments:${role}:${userId}`)
                    .setLabel('💬 最新コメントを確認')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!summary || summary.count === 0)
            );

            await interaction.editReply({
                content: '',
                embeds: [embed],
                components: [btnRow]
            });
        }
    });
};

/**
 * コメント確認ボタンの処理
 */
module.exports.handleCommentCheck = async function (interaction, role, userId) {
    return interactionTemplate(interaction, {
        ack: ACK.REPLY, // 新しいメッセージで表示（ephemeral）
        adminOnly: true,
        async run(interaction) {
            const summary = await getRatingSummary(interaction.guildId, userId, role);
            if (!summary || !summary.comments || summary.comments.length === 0) {
                return interaction.editReply({ content: 'コメントはありません。' });
            }

            const commentsText = summary.comments.map((c, i) => {
                const date = new Date(c.updatedAt).toLocaleDateString('ja-JP');
                const stars = '⭐'.repeat(parseInt(c.stars || 0));
                return `**${i + 1}. ${date}** ${stars}\n${c.comment || '(コメントなし)'}`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setTitle(`💬 最新コメント（${summary.comments.length}件）`)
                .setDescription(commentsText)
                .setColor(0xffd700);

            await interaction.editReply({ embeds: [embed] });
        }
    });
};

function buildRatingSummaryEmbed(user, role, summary) {
    const roleName = role === 'driver' ? '送迎者' : '利用者';
    const embed = new EmbedBuilder()
        .setTitle(`📊 口コミ評価: ${user ? user.tag : '不明'} (${roleName})`)
        .setColor(0xffd700);

    if (!summary || summary.count === 0) {
        embed.setDescription('評価データはまだありません。');
        return embed;
    }

    // 星の分布グラフ
    const dist = summary.distribution;
    const max = Math.max(...Object.values(dist));

    const graph = [5, 4, 3, 2, 1].map(star => {
        const count = dist[star] || 0;
        const barLength = max > 0 ? Math.round((count / max) * 10) : 0;
        const bar = '🟦'.repeat(barLength) + '⬜'.repeat(10 - barLength);
        return `\`${star}星\` ${bar} (${count}件)`;
    }).join('\n');

    embed.addFields(
        { name: '総合評価', value: `**${summary.average}** / 5.0`, inline: true },
        { name: '総レビュー数', value: `${summary.count} 件`, inline: true },
        { name: '評価分布', value: graph, inline: false }
    );

    if (summary.comments && summary.comments.length > 0) {
        embed.addFields({ name: 'コメントあり', value: `${summary.comments.length} 件（直近）`, inline: true });
    }

    return embed;
}
