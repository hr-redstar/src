// src/bot/utils/メンテナンス/retentionAgent.js
const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');
const logger = require('../logger');

/**
 * 期限切れVCの自動削除とデータのクリーンアップ
 * @param {import('discord.js').Guild} guild
 */
async function runRetentionAuditor(guild) {
    const guildId = guild.id;
    const vcStatePath = paths.vcStateJson(guildId);
    const vcStates = await store.readJson(vcStatePath, {}).catch(() => ({}));

    const now = Date.now();
    let changed = false;

    // 1. 期限切れVCのチェック
    for (const [chId, data] of Object.entries(vcStates)) {
        if (!data.expiresAt) continue;

        const expiry = new Date(data.expiresAt).getTime();
        if (now > expiry) {
            // 期限切れ発動
            const channel = await guild.channels.fetch(chId).catch(() => null);
            if (channel) {
                await channel.delete('保持期限（1週間）経過による自動クリーンアップ').catch((err) => {
                    logger.warn(`[RetentionAgent] VC削除失敗 (${chId}): ${err.message}`);
                });
            }
            delete vcStates[chId];
            changed = true;
        }
    }

    if (changed) {
        await store.writeJson(vcStatePath, vcStates);
        logger.info(`[RetentionAgent] ギルド(${guildId}) の期限切れVCをクリーンアップしました。`);
    }

    // 2. 将来的な拡張: 古い履歴（1年以上）のアーカイブ移動などをここに追加可能
}

module.exports = { runRetentionAuditor };
