// handler/管理者パネル/システム診断.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const { RideStatus } = require('../../utils/constants');

/**
 * システム診断の実行
 */
async function runDiagnostics(interaction, client) {
    const guild = interaction.guild;
    const guildId = guild.id;

    // 1. 進行中送迎の整合性チェック (Ghost Dispatch Check)
    const activeDir = paths.activeDispatchDir(guildId);
    const files = await store.listKeys(activeDir).catch(() => []);
    const results = {
        totalActive: 0,
        ghostDispatches: [],
        queueIssues: [],
    };

    for (const fileKey of files) {
        if (!fileKey.endsWith('.json')) continue;
        const data = await store.readJson(fileKey).catch(() => null);
        if (!data) continue;

        results.totalActive++;

        // VCの存在確認
        if (data.vcId) {
            const channel = guild.channels.cache.get(data.vcId) || await guild.channels.fetch(data.vcId).catch(() => null);
            if (!channel) {
                results.ghostDispatches.push({
                    id: data.rideId,
                    type: 'VC消失',
                    user: data.userId,
                    driver: data.driverId
                });
            }
        }
    }

    // 2. 待機列の整合性チェック
    const { getQueue } = require('../../utils/配車/待機列マネージャ');
    const queue = await getQueue(guildId);
    if (queue) {
        for (const item of queue) {
            const member = await guild.members.fetch(item.userId).catch(() => null);
            if (!member) {
                results.queueIssues.push({ userId: item.userId, reason: 'サーバー脱退' });
                continue;
            }
        }
    }

    // 3. インデックス整合性チェック (Index vs Files)
    const userIndex = await store.readJson(paths.guildUserIndexJson(guildId), []).catch(() => []);
    const driverIndex = await store.readJson(paths.guildDriverIndexJson(guildId), []).catch(() => []);

    results.indexIssues = [];

    // インデックスに載っているがファイルがない
    for (const uid of userIndex) {
        if (!await store.exists(paths.userProfileJson(guildId, uid))) {
            results.indexIssues.push({ type: '利用者Index不整合', id: uid });
        }
    }
    for (const did of driverIndex) {
        if (!await store.exists(paths.driverProfileJson(guildId, did))) {
            results.indexIssues.push({ type: '送迎者Index不整合', id: did });
        }
    }

    // 4. 結果表示
    const embed = buildPanelEmbed({
        title: '🩺 システム整合性診断結果',
        description: 'システムの内部状態と Discord サーバーの同期状態を診断しました。',
        color: (results.ghostDispatches.length > 0 || results.queueIssues.length > 0 || results.indexIssues.length > 0) ? 0xe67e22 : 0x2ecc71,
        client
    });

    embed.addFields({
        name: '📊 診断統計',
        value: [
            `🔹 進行中データ総数: **${results.totalActive}** 件`,
            `👻 検知されたゴースト送迎: **${results.ghostDispatches.length}** 件`,
            `⚠️ 待機列の不整合: **${results.queueIssues.length}** 件`,
            `🔍 インデックス不整合: **${results.indexIssues.length}** 件`
        ].join('\n'),
        inline: false
    });

    if (results.ghostDispatches.length > 0) {
        embed.addFields({
            name: '🚨 発見された問題',
            value: results.ghostDispatches.map(g => `・ID: \`${g.id}\` (VCが削除されています)`).join('\n').substring(0, 1024),
            inline: false
        });
    }

    const row = new ActionRowBuilder();
    if (results.ghostDispatches.length > 0 || results.queueIssues.length > 0) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('admin|diagnostics|sub=repair')
                .setLabel('一括修復を実行')
                .setEmoji('🛠️')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('admin|diagnostics|sub=cancel')
                .setLabel('閉じる')
                .setStyle(ButtonStyle.Secondary)
        );
    } else {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId('admin|diagnostics|sub=cancel')
                .setLabel('正常（閉じる）')
                .setStyle(ButtonStyle.Success)
        );
    }

    return interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * 自己修復の実行
 */
async function executeRepair(interaction, client) {
    const guildId = interaction.guildId;
    const activeDir = paths.activeDispatchDir(guildId);
    const files = await store.listKeys(activeDir).catch(() => []);

    let repairCount = 0;

    // 1. ゴースト送迎の削除
    for (const fileKey of files) {
        if (!fileKey.endsWith('.json')) continue;
        const data = await store.readJson(fileKey).catch(() => null);
        if (!data) continue;

        if (data.vcId) {
            const channel = interaction.guild.channels.cache.get(data.vcId) || await interaction.guild.channels.fetch(data.vcId).catch(() => null);
            if (!channel) {
                await store.deleteFile(fileKey).catch(() => null);
                repairCount++;
            }
        }
    }

    // 2. 待機列の修復（脱退済み等の削除）
    const waitDir = paths.waitingDriversDir(guildId);
    const waitFiles = await store.listKeys(waitDir).catch(() => []);
    for (const wf of waitFiles) {
        const userId = wf.split('/').pop().replace('.json', '');
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) {
            await store.deleteFile(wf).catch(() => null);
            repairCount++;
        }
    }

    // 3. インデックスの再構築 (Wipe後や消失後のクリーンアップ) (v2.9.3)
    const userRoot = paths.userRoot(guildId);
    const userKeys = await store.listKeys(userRoot).catch(() => []);
    const newUserIndex = userKeys
        .filter(k => k.endsWith('/登録情報.json'))
        .map(k => k.split('/').slice(-2, -1)[0]);
    await store.writeJson(paths.guildUserIndexJson(guildId), newUserIndex);

    const driverRoot = paths.driverRoot(guildId);
    const driverKeys = await store.listKeys(driverRoot).catch(() => []);
    const newDriverIndex = driverKeys
        .filter(k => k.endsWith('/登録情報.json'))
        .map(k => k.split('/').slice(-2, -1)[0]);
    await store.writeJson(paths.guildDriverIndexJson(guildId), newDriverIndex);

    return interaction.editReply({
        content: `✅ 修正が完了しました。計 **${repairCount}** 件の不整合を解消し、インデックスを再構築しました。`,
        embeds: [],
        components: []
    });
}

module.exports = { runDiagnostics, executeRepair };
