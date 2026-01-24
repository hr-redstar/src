const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { buildDispatchEmbed } = require('../../utils/配車/dispatchEmbedBuilder');
const { updateRideOperatorLog } = require('../../utils/ログ/rideLogManager');
const { getRideLog } = require('../../utils/ログ/rideLogStore');
const logger = require('../../utils/logger');

/**
 * 送迎進捗をグローバルに更新し、全Embedを同期する
 */
async function updateDispatchProgress({ guild, rideId, status, updates = {} }) {
    try {
        const activePath = `${paths.activeDispatchDir(guild.id)}/${rideId}.json`;
        let dispatchData = await store.readJson(activePath).catch(() => null);
        if (!dispatchData) return;

        // データの更新
        dispatchData = { ...dispatchData, ...updates, status };
        await store.writeJson(activePath, dispatchData);

        // 1. 運営者ログの更新 (1 Ride = 1 Embed)
        await updateRideOperatorLog({
            guild,
            rideId,
            status,
            data: dispatchData
        });

        // 2. VC内 Embed の更新
        if (dispatchData.vcId && dispatchData.vcMessageId) {
            const vc = await guild.channels.fetch(dispatchData.vcId).catch(() => null);
            if (vc && vc.isTextBased()) {
                const message = await vc.messages.fetch(dispatchData.vcMessageId).catch(() => null);
                if (message) {
                    const embed = buildDispatchEmbed(dispatchData);
                    await message.edit({ embeds: [embed] }).catch(err => {
                        logger.warn(`VCメッセージ編集失敗: ${err.message}`);
                    });
                }
            }
        }

        // 3. 利用者メモ個人メッセージの更新
        if (dispatchData.userMemoChannelId && dispatchData.userMemoMessageId) {
            const memoCh = await guild.channels.fetch(dispatchData.userMemoChannelId).catch(() => null);
            if (memoCh && memoCh.isTextBased()) {
                const msg = await memoCh.messages.fetch(dispatchData.userMemoMessageId).catch(() => null);
                if (msg) {
                    const embed = buildDispatchEmbed(dispatchData);
                    await msg.edit({ embeds: [embed] }).catch(() => null);
                }
            }
        }

        return dispatchData;
    } catch (error) {
        logger.error(`進捗更新エラー: ${error.message}`, error);
    }
}

module.exports = { updateDispatchProgress };
