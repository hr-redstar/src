const { loadConfig } = require('../設定/設定マネージャ');
const { buildVcControlEmbed } = require('../配車/vcControlEmbedBuilder');

/**
 * 運営者ログの同期（作成・更新）を行う
 * @param {Guild} guild 
 * @param {Object} dispatchData 
 * @returns {Promise<string|null>} 送信・更新したメッセージID (失敗時は null)
 */
async function syncOperationLog(guild, dispatchData) {
    try {
        const config = await loadConfig(guild.id);
        const targetChannelId = config.logs.operatorChannel;
        if (!targetChannelId) return null;

        const channel = await guild.channels.fetch(targetChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return null;

        // 1. 基本Embedを作成 (VCコントロール用を流用)
        const baseEmbed = buildVcControlEmbed(dispatchData);

        // 2. カラーのオーバーライド (仕様に基づく)
        // マッチング時：黄 (status=dispatching, approachTimeなし)
        // 向かってます：青 (approachTimeあり)
        // 送迎開始：青
        // 相乗り開始：青
        // 送迎終了：まだ乗客が残っている際は青　いない場合　黒
        // 期限延長：赤 (dispatchData.isExtended = true)

        // デフォルトは黄(Start前、向かう前) => マッチング時
        let color = 0xffff00; // Yellow

        // 向かっています (approachTimeがある)
        if (dispatchData.approachTime) {
            color = 0x3498db; // Blue
        }

        // 誰か開始している
        const driverStarted = !!dispatchData.driverStartTime;
        const userStarted = !!dispatchData.userStartTime;
        const anyCarpoolStarted = (dispatchData.carpoolUsers || []).some(u => u.startTime);
        if (driverStarted || userStarted || anyCarpoolStarted) {
            color = 0x3498db; // Blue
        }

        // 終了判定
        const driverEnded = !!dispatchData.driverEndTime;
        const userEnded = !!dispatchData.userEndTime;
        const allCarpoolEnded = (dispatchData.carpoolUsers || []).every(u => u.endTime);
        if (driverEnded && userEnded && allCarpoolEnded) {
            // 全員終了
            color = 0x010101; // Black
        }

        // 延長判定 (statusに関係なく赤)
        if (dispatchData.isExtended) {
            color = 0xff0000; // Red
        }

        baseEmbed.setColor(color);

        // 3. 送信 または 編集
        const msgId = dispatchData.operationLogMessageId;
        if (msgId) {
            // 既存メッセージの更新
            const msg = await channel.messages.fetch(msgId).catch(() => null);
            if (msg) {
                await msg.edit({ embeds: [baseEmbed] });
                return msgId;
            }
            // メッセージが見つからない場合は新規作成へ落ちる
        }

        // 新規送信
        const sentMsg = await channel.send({ embeds: [baseEmbed] });
        return sentMsg.id;

    } catch (err) {
        console.error('運営者ログ同期エラー:', err);
        return null;
    }
}

module.exports = { syncOperationLog };
