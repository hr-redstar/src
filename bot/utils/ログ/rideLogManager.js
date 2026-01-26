// src/bot/utils/ログ/rideLogManager.js
// utils/ログ/rideLogManager.js
const { MessageFlags, ChannelType } = require('discord.js');
const { loadConfig } = require('../設定/設定マネージャ');
const { getRideLog, saveRideLog, removeRideLog } = require('./rideLogStore');
const { buildRideEmbed } = require('./buildRideEmbed');
const logger = require('../logger');

/**
 * 送迎運営ログを更新する (同一送迎＝1 Embed 更新型)
 * 
 * @param {Object} params
 * @param {import('discord.js').Guild} params.guild
 * @param {string} params.rideId - 送迎識別ID (guildId_driverId_timestamp)
 * @param {string} params.status - MATCHED, STARTED, ENDED, FORCED
 * @param {Object} params.data - 表示用データ
 */
async function updateRideOperatorLog({ guild, rideId, status, data }) {
    try {
        const config = await loadConfig(guild.id);
        const logChId = config.logs?.operatorChannel;
        if (!logChId) return;

        const channel = await guild.channels.fetch(logChId).catch(() => null);
        if (!channel) {
            logger.warn(`運営者ログチャンネルが見つかりません: id=${logChId}`);
            return;
        }

        const logRef = await getRideLog(guild.id, rideId);

        // データのマージ (matchedAt などを集約するため)
        let combinedData = {
            ...(logRef?.data || {}),
            ...data,
            rideId
        };

        // IDが欠落している場合、Active Dispatchから補完 (v2.6.4)
        if (!combinedData.userId || !combinedData.driverId) {
            const { readJson } = require('../ストレージ/ストア共通');
            const paths = require('../ストレージ/ストレージパス');
            const activePath = `${paths.activeDispatchDir(guild.id)}/${rideId}.json`;
            const dispatchData = await readJson(activePath).catch(() => null);
            if (dispatchData) {
                combinedData.userId = combinedData.userId || dispatchData.userId;
                combinedData.driverId = combinedData.driverId || dispatchData.driverId;
            }
        }

        const statusTextMap = {
            'MATCHED': 'マッチング',
            'HEADING': '向かっています',
            'STARTED': '送迎中',
            'ENDED': '送迎終了',
            'FORCED': '送迎終了 (強制)'
        };
        const content = statusTextMap[status] || '送迎中';

        const embed = buildRideEmbed({ status, data: combinedData });

        if (!logRef) {
            // 新規送信
            if (status === 'MATCHED' || status === 'STARTED') {
                const message = await channel.send({ content, embeds: [embed] }).catch(err => {
                    logger.error(`運営者ログ送信失敗: ${err.message}`);
                    return null;
                });

                if (message) {
                    await saveRideLog(guild.id, rideId, {
                        channelId: channel.id,
                        messageId: message.id,
                        data: combinedData // 状態を保存
                    });
                }
            }
        } else {
            // 既存編集
            const threadOrChannel = logRef.channelId === channel.id ? channel : (await guild.channels.fetch(logRef.channelId).catch(() => null));
            if (threadOrChannel) {
                const message = await threadOrChannel.messages.fetch(logRef.messageId).catch(() => null);
                if (message) {
                    console.log(`[rideLogManager] 運営者ログを編集します: rideId=${rideId}, status=${status}, times=[H:${combinedData.headingTime}, S:${combinedData.startTime}, E:${combinedData.endTime}]`);
                    await message.edit({ content, embeds: [embed] }).catch(err => {
                        logger.error(`運営者ログ編集失敗: ${err.message}`);
                    });

                    // データを更新して保存
                    await saveRideLog(guild.id, rideId, {
                        ...logRef,
                        data: combinedData
                    });
                } else {
                    // メッセージが消えている場合は再送信
                    const newMessage = await channel.send({ embeds: [embed] }).catch(() => null);
                    if (newMessage) {
                        await saveRideLog(guild.id, rideId, {
                            channelId: channel.id,
                            messageId: newMessage.id,
                            data: combinedData
                        });
                    }
                }
            }
        }

        // 完了または強制終了の場合でも、延長の可能性があるため情報を保持する
        // (TTLによる自動クリーンアップまたは手動削除を別途検討)
    } catch (error) {
        logger.error(`運営者ログマネージャエラー: ${error.message}`, error);
    }
}

module.exports = {
    updateRideOperatorLog,
};
