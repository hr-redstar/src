const { EmbedBuilder } = require('discord.js');
const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');
const { loadConfig } = require('../設定/設定マネージャ');

/**
 * 送迎者の出勤時の詳細情報を運営者・管理者に通知する
 */
async function postDetailedAttendanceLog({ guild, user, data, type = 'on' }) {
    const config = await loadConfig(guild.id);
    const actionText = type === 'on' ? '出勤' : '退勤';
    const color = type === 'on' ? 0x2ecc71 : 0xe74c3c;

    const now = new Date();
    const nowStr = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const timestamp = now;

    // 退勤時の特別フォーマット
    if (type === 'off') {
        const startTime = data.clockInTime ? new Date(data.clockInTime) : null;
        const timeRange = startTime
            ? `${formatDateShort(startTime)} ～ ${formatDateShort(now)}`
            : `不明 ～ ${formatDateShort(now)}`;

        const embed = new EmbedBuilder()
            .setTitle('🚗 送迎者退勤詳細')
            .setColor(color)
            .addFields(
                { name: "ユーザー", value: `<@${user.id}> (${user.tag})`, inline: false },
                { name: "車種・ナンバー", value: data.carInfo || "未設定", inline: true },
                { name: "乗車人数", value: `${data.capacity || "未設定"}`, inline: true },
                { name: "稼働時間", value: timeRange, inline: false },
                { name: "送迎件数", value: `${data.rideCount || 0}件`, inline: false },
                { name: "更新日時", value: nowStr, inline: false }
            )
            .setTimestamp(timestamp);

        // 共通処理へ続くため、ここでsend処理を呼び出すか、あるいは embed 変数に代入して後続処理を利用する
        // 後続の postOperatorLog 等を利用するため、embedを返す形にするのが良いが、ここは既存コードに合わせる
        // 既存コードは embed を作成して下部で送信している

        // 1. 運営者ログ
        const { postOperatorLog } = require('./運営者ログ');
        await postOperatorLog({ guild, embeds: [embed] }).catch(() => null);

        // 2. 管理者ログスレッド
        const threadId = config.logs?.adminLogThread;
        if (threadId) {
            const thread = await guild.channels.fetch(threadId).catch(() => null);
            if (thread && thread.isThread()) {
                const content = `[詳細ログ] 送迎者が待機を終了しました。`;
                await thread.send({ content, embeds: [embed] }).catch(() => null);
            }
        }
        return; // 退勤時はここで終了
    }

    // 出勤時のフォーマット (既存維持)
    // 稼働時間の計算
    let workingTime = "計測中";
    if (data.clockInTime) {
        const startTime = new Date(data.clockInTime);
        const diffMs = now - startTime;
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        workingTime = `${hours}時間${minutes}分`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🚗 送迎者${actionText}詳細`)
        .setColor(color)
        .addFields(
            { name: "ユーザー", value: `<@${user.id}> (${user.tag})`, inline: false },
            { name: "停留場所", value: data.stopPlace || "未設定", inline: true },
            { name: "車種・ナンバー", value: data.carInfo || "未設定", inline: true },
            { name: "乗車人数", value: `${data.capacity || "未設定"}`, inline: true },
            { name: "稼働時間", value: workingTime, inline: true },
            { name: "更新日時", value: nowStr, inline: false }
        )
        .setTimestamp(timestamp);

    // 1. 運営者ログ (通常のテキストチャンネル)
    const { postOperatorLog } = require('./運営者ログ');
    await postOperatorLog({ guild, embeds: [embed] }).catch(() => null);

    // 2. 管理者ログスレッド (特定のスレッド)
    const threadId = config.logs?.adminLogThread;
    if (threadId) {
        const thread = await guild.channels.fetch(threadId).catch(() => null);
        if (thread && thread.isThread()) {
            // さらに詳細な情報をテキストで追加可能
            const content = type === 'on'
                ? `[詳細ログ] 送迎者が待機を開始しました。`
                : `[詳細ログ] 送迎者が待機を終了しました。`;

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
        timeZone: 'Asia/Tokyo'
    });
}

module.exports = { postDetailedAttendanceLog };
