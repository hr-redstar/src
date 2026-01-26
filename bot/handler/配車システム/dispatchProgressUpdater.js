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
                // 完了時にチャンネル名を更新 (終了時刻を反映)
                const { RideStatus } = require('../../utils/constants');
                if (status === RideStatus.COMPLETED || status === 'completed') {
                    const date = dispatchData.date || '--/--';
                    const start = dispatchData.matchTime || '--:--';
                    const end = dispatchData.endTime || '--:--';
                    const dp = dispatchData.driverPlace || '不明';
                    const pu = dispatchData.pickup || '不明';
                    const tg = dispatchData.target || dispatchData.direction || '不明';
                    const newName = `${date} ${start}~${end} 【${dp}】→【${pu}】→【${tg}】`;
                    await vc.setName(newName.substring(0, 100)).catch(err => {
                        logger.warn(`VC名更新失敗: ${err.message}`);
                    });
                }

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
            const channelId = dispatchData.userLogThreadId || dispatchData.userMemoChannelId;
            const container = await guild.channels.fetch(channelId).catch(() => null);
            if (container && container.isTextBased()) {
                const msg = await container.messages.fetch(dispatchData.userMemoMessageId).catch(() => null);
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
