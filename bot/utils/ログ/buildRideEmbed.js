// src/bot/utils/ログ/buildRideEmbed.js
const { EmbedBuilder } = require('discord.js');

/**
 * 送迎ステータスに応じたEmbed構成を定義
 */
const STATUS_CONFIG = {
    MATCHED: {
        title: '🟡 配車確定（マッチング）',
        color: 0xf1c40f, // Yellow
        emoji: '🤝',
    },
    DEPARTED: {
        title: '🟣 向かっています（出発）',
        color: 0x9b59b6, // Purple
        emoji: '🚐',
    },
    STARTED: {
        title: '🔵 送迎中（実車）',
        color: 0x3498db, // Blue
        emoji: '🚕', // Passenger onboard
    },
    ENDED: {
        title: '✅ 送迎完了（帰庫）',
        color: 0x2ecc71, // Green
        emoji: '🏁',
    },
    CANCELLED: {
        title: '⚪ 送迎キャンセル',
        color: 0x95a5a6, // Gray
        emoji: '🚫',
    },
    FORCED: {
        title: '🚨 強制終了',
        color: 0xe74c3c, // Red
        emoji: '🛑',
    },
};

/**
 * 運営者ログ用Embedを生成する (v1.7.0 Professional)
 */
function buildRideEmbed({ status, data }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.MATCHED;

    const embed = new EmbedBuilder()
        .setTitle(`【送迎ログ】${config.title}`)
        .setColor(config.color)
        .addFields(
            { name: '👤 利用者', value: data.userName ? `**${data.userName}** (<@${data.userId}>)` : `<@${data.userId}>`, inline: true },
            { name: '🚗 送迎者', value: data.driverNickname ? `**${data.driverNickname}** (<@${data.driverId}>)` : `<@${data.driverId}>`, inline: true },
            { name: '📍 方面/目的地', value: data.area || data.destination || data.from || '不明', inline: false }
        )
        .setTimestamp();

    // タイムスタンプ・経過時間の表示
    let timeInfo = `状態：${config.emoji} ${config.title}\n`;

    if (data.matchedAt) {
        timeInfo += `⌚ 配車確定：${new Date(data.matchedAt).toLocaleTimeString('ja-JP')} `;
    }

    if (status === 'ENDED' || status === 'FORCED') {
        if (data.matchedAt) {
            const duration = Date.now() - new Date(data.matchedAt);
            const mins = Math.floor(duration / 60000);
            timeInfo += `\n⏱️ 所要時間：約 ${mins} 分`;
        }
    }

    if (data.isExtended) {
        timeInfo += '\n⚠️ **【保存期間延長：トラブル・確認事項あり】**';
    }

    embed.addFields({ name: '📊 運行状況', value: timeInfo, inline: false });

    // 追加情報（人数など）
    if (data.count) {
        embed.addFields({ name: '👥 人数', value: `${data.count} 名`, inline: true });
    }

    if (status === 'ENDED' || status === 'FORCED' || status === 'CANCELLED') {
        embed.setFooter({ text: `Ride ID: ${data.rideId} ｜ 記録終了` });
    } else {
        embed.setFooter({ text: `Ride ID: ${data.rideId} ｜ 進行中...` });
    }

    return embed;
}

module.exports = {
    buildRideEmbed,
};
