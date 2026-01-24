const buildPanelEmbed = require('../embed/embedTemplate');

/**
 * 送迎者の出勤時の詳細情報を運営者・管理者に通知する (v1.8.0 Professional)
 */
async function postDetailedAttendanceLog({ guild, user, data, type = 'on' }) {
    const config = await loadConfig(guild.id);
    const actionText = type === 'on' ? '出勤' : '退勤';
    const color = type === 'on' ? 0x2ecc71 : 0xe74c3c;
    const emoji = type === 'on' ? '🚀' : '🏁';

    const now = new Date();
    const nowStr = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const embed = buildPanelEmbed({
        title: `${emoji} 送迎者${actionText}詳細`,
        color: color,
        client: guild.client
    });

    if (type === 'off') {
        const startTime = data.clockInTime ? new Date(data.clockInTime) : null;
        const timeRange = startTime
            ? `\`${formatDateShort(startTime)} ～ ${formatDateShort(now)}\``
            : '`不明`';

        embed.addFields(
            { name: '👤 対象者', value: `<@${user.id}> (${user.tag})`, inline: false },
            { name: '📅 稼働期間', value: timeRange, inline: false },
            { name: '📊 送迎実績', value: `\`${data.rideCount || 0}\` 件`, inline: true },
            { name: '🚗 車両情報', value: `${data.carInfo || '未設定'}`, inline: true },
            { name: '👥 最大定員', value: `${data.capacity || '未設定'} 名`, inline: true }
        );
    } else {
        // 出勤時
        embed.addFields(
            { name: '👤 対象者', value: `<@${user.id}> (${user.tag})`, inline: false },
            { name: '🚗 車両情報', value: `${data.carInfo || '未設定'}`, inline: true },
            { name: '👥 最大定員', value: `${data.capacity || '未設定'} 名`, inline: true }
        );
    }

    embed.setFooter({ text: `記録日時: ${nowStr} ｜ v1.8.0 Detailed Log` });

    // 1. 運営者ログ (通常のテキストチャンネル)
    const { postOperatorLog } = require('./運営者ログ');
    await postOperatorLog({ guild, embeds: [embed] }).catch(() => null);

    // 2. 管理者ログスレッド (特定のスレッド)
    const threadId = config.logs?.adminLogThread;
    if (threadId) {
        const thread = await guild.channels.fetch(threadId).catch(() => null);
        if (thread && thread.isTextBased()) {
            const content = `[詳細ログ] 送迎者が待機を${type === 'on' ? '開始' : '終了'}しました。`;
            await thread.send({ content, embeds: [embed] }).catch(() => null);
        }
    }
}

function formatDateShort(date) {
    return date.toLocaleString('ja-JP', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo',
    });
}

module.exports = { postDetailedAttendanceLog };
