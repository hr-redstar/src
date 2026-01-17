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
        // マッチング時：赤 (status=dispatching, approachTimeなし)
        // 向かってます：青 (approachTimeあり)
        // 送迎開始：青
        // 相乗り開始：青
        // 送迎終了：まだ乗客が残っている際は青　いない場合　黒

        // デフォルトは赤(Start前、向かう前)
        let color = 0xff0000; // Red

        // 向かっています (approachTimeがある)
        if (dispatchData.approachTime) {
            color = 0x3498db; // Blue
        }

        // 誰か開始している (StartTimesがある)
        const driverStarted = !!dispatchData.driverStartTime;
        const userStarted = !!dispatchData.userStartTime;
        const anyCarpoolStarted = (dispatchData.carpoolUsers || []).some(u => u.startTime);
        if (driverStarted || userStarted || anyCarpoolStarted) {
            color = 0x3498db; // Blue
        }

        // 終了判定
        // 全員終わっているか？
        const driverEnded = !!dispatchData.driverEndTime;
        const userEnded = !!dispatchData.userEndTime;
        const allCarpoolEnded = (dispatchData.carpoolUsers || []).every(u => u.endTime);
        // 誰か一人でも終わっていない、かつ、誰か始まっている/向かっているなら青のまま
        // 全員終わったら黒
        if (driverEnded && userEnded && allCarpoolEnded) {
            // 全員終了
            color = 0x000000; // Black (Discordでは0x000000はデフォルト色になることがあるが、明示的な黒は 0x010101 とかにすべき？ Defaultは黒っぽいのでOK)
            // embed.setColor(0) はデフォルト色に戻る挙動。
            // 真っ黒にするなら 0x010101
            color = 0x010101;
        } else {
            // まだ乗客がいる(完了していない)
            // status completed かどうかでも判断できるが、個別の状態を見る
            // 上記の Blue 条件に入っていれば Blue。
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
