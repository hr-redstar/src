const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 履歴・評価表示ハンドラー
 */
module.exports = async function (interaction, client) {
    const { customId } = interaction;

    if (customId === 'admin:btn:history_recent') return showRecentHistory(interaction);
    if (customId === 'admin:btn:history_detail') return showHistoryMonthSelect(interaction);
    if (customId.startsWith('admin:select:history_month')) return showHistoryDaySelect(interaction);
    if (customId.startsWith('admin:select:history_day')) return showHistoryResult(interaction);

    return autoInteractionTemplate(interaction, {
        adminOnly: true,
        ack: ACK.REPLY,
        async run(interaction) {
            if (customId.includes('rating')) {
                return showRatingList(interaction);
            }
            // 互換性のため古い ID も recent へ
            return showRecentHistory(interaction);
        }
    });
};

/**
 * 直近10件の履歴を表示
 */
async function showRecentHistory(interaction) {
    return autoInteractionTemplate(interaction, {
        adminOnly: true,
        ack: ACK.REPLY,
        async run(interaction) {
            const guildId = interaction.guildId;
            const now = new Date();
            const historyDir = paths.dispatchHistoryDir(guildId, now.getFullYear(), now.getMonth() + 1);

            const files = await store.listKeys(historyDir).catch(() => []);
            const jsonFiles = files.filter(f => f.endsWith('.json')).slice(-10).reverse();

            const embed = new EmbedBuilder()
                .setTitle("🕒 最近の配車履歴 (最新10件)")
                .setColor(0x3498db);

            if (jsonFiles.length === 0) {
                embed.setDescription("最近の履歴データは見つかりません。");
            } else {
                const lines = [];
                for (const fileKey of jsonFiles) {
                    const data = await store.readJson(fileKey).catch(() => null);
                    if (data) {
                        const time = new Date(data.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                        lines.push(`\`${time}\` <@${data.driverId}> ➔ <@${data.passengerId}> (${data.direction || '詳細不明'})`);
                    }
                }
                embed.setDescription(lines.join('\n'));
            }
            return interaction.editReply({ embeds: [embed] });
        }
    });
}

/**
 * 月選択の表示
 */
async function showHistoryMonthSelect(interaction) {
    const now = new Date();
    const options = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        options.push({ label: `${y}年${m}月`, value: `${y}-${m}` });
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId('admin:select:history_month')
        .setPlaceholder('年月を選択してください')
        .addOptions(options);

    const row = new ActionRowBuilder().addComponents(select);
    return interaction.reply({ content: "📅 履歴を確認したい **年月** を選択してください。", components: [row], flags: 64 });
}

/**
 * 日選択の表示
 */
async function showHistoryDaySelect(interaction) {
    return autoInteractionTemplate(interaction, {
        adminOnly: true,
        ack: ACK.UPDATE,
        async run(interaction) {
            const [y, m] = interaction.values[0].split('-');
            const guildId = interaction.guildId;
            // dispatchHistoryDir（全体履歴）のディレクトリを走査して、その月にある「日」を特定するのは
            // 構造上難しいため（フラットに全ファイルがあるため）、ここでは単純に1〜31を表示するか入力にする
            // ※ 今回は簡略化のため、当月分を想定して最近の日付を表示するか、全て表示する

            const options = [];
            for (let d = 1; d <= 31; d++) {
                options.push({ label: `${d}日`, value: `${y}-${m}-${d}` });
            }

            const select = new StringSelectMenuBuilder()
                .setCustomId('admin:select:history_day')
                .setPlaceholder('日付を選択してください')
                .addOptions(options.slice(0, 25)); // Discord制限

            const row = new ActionRowBuilder().addComponents(select);
            await interaction.editReply({ content: `📅 **${y}年${m}月** のどの日付を確認しますか？`, components: [row] });
        }
    });
}

/**
 * 指定日の結果を表示
 */
async function showHistoryResult(interaction) {
    return autoInteractionTemplate(interaction, {
        adminOnly: true,
        ack: ACK.UPDATE,
        async run(interaction) {
            const [y, m, d] = interaction.values[0].split('-');
            const guildId = interaction.guildId;
            const historyDir = paths.dispatchHistoryDir(guildId, parseInt(y), parseInt(m));

            const allFiles = await store.listKeys(historyDir).catch(() => []);
            const datePrefix = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

            // ファイル名が YYYY-MM-DD_... または timestamp から始まる想定。
            // 確実なのは中身をチェックすることだが、数が多いと重い。
            // ここでは簡易的に「全て」読み込んでフィルタする。
            const results = [];
            for (const fileKey of allFiles) {
                if (!fileKey.endsWith('.json')) continue;
                const data = await store.readJson(fileKey).catch(() => null);
                if (data) {
                    const cDate = new Date(data.createdAt);
                    if (cDate.getFullYear() == y && (cDate.getMonth() + 1) == m && cDate.getDate() == d) {
                        results.push(data);
                    }
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`📅 送迎履歴: ${y}/${m}/${d}`)
                .setColor(0x00ff00);

            if (results.length === 0) {
                embed.setDescription("指定された日の履歴はありません。");
            } else {
                results.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                const lines = results.map(r => {
                    const time = new Date(r.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                    return `\`${time}\` <@${r.driverId}> ➔ <@${r.passengerId}> (${r.direction || '詳細不明'})`;
                });
                embed.setDescription(lines.join('\n'));
            }

            await interaction.editReply({ content: null, embeds: [embed], components: [] });
        }
    });
}

/**
 * 最近の評価一覧を表示
 */
async function showRatingList(interaction) {
    const guildId = interaction.guildId;
    const driverRatingDir = `${guildId}/logs/評価/送迎者`;
    const userRatingDir = `${guildId}/logs/評価/利用者`;

    const [driverFiles, userFiles] = await Promise.all([
        store.listKeys(driverRatingDir).catch(() => []),
        store.listKeys(userRatingDir).catch(() => [])
    ]);

    const allFiles = [
        ...driverFiles.filter(f => f.endsWith('.json')).map(f => ({ path: f, type: '送迎者' })),
        ...userFiles.filter(f => f.endsWith('.json')).map(f => ({ path: f, type: '利用者' }))
    ];

    allFiles.sort((a, b) => b.path.localeCompare(a.path));
    const recentFiles = allFiles.slice(0, 10);

    const embed = new EmbedBuilder()
        .setTitle("⭐ 最近の口コミ・評価 (最新10件)")
        .setColor(0xffd700);

    if (recentFiles.length === 0) {
        embed.setDescription("評価データが見つかりません。");
    } else {
        const lines = [];
        for (const item of recentFiles) {
            const data = await store.readJson(item.path).catch(() => null);
            if (data && data.current) {
                const stars = data.current.stars ? '⭐'.repeat(data.current.stars) : '💬';
                const comment = data.current.comment ? `\n   ┗ "${data.current.comment}"` : "";
                let targetDisplay = '不明';
                const dispatchId = item.path.split('/').pop().replace('.json', '');

                const now = new Date();
                const historyPath = `${paths.dispatchHistoryDir(guildId, now.getFullYear(), now.getMonth() + 1)}/${dispatchId}.json`;
                const dispatchData = await store.readJson(historyPath).catch(() => null);

                if (dispatchData) {
                    const targetId = item.type === '送迎者' ? dispatchData.driverId : dispatchData.passengerId;
                    targetDisplay = `<@${targetId}>`;
                }
                lines.push(`【${item.type}評】${targetDisplay} ➔ ${stars} (by <@${data.raterId}>)${comment}`);
            }
        }
        embed.setDescription(lines.join('\n'));
    }
    return interaction.editReply({ embeds: [embed] });
}
