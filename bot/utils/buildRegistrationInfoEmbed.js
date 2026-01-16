const { EmbedBuilder } = require('discord.js');

/**
 * 送迎者用 登録情報Embedを生成
 */
function buildDriverRegistrationEmbed(registrationJson, user) {
    const embed = new EmbedBuilder()
        .setTitle('📋 送迎者 登録情報')
        .setColor(0x2ecc71) // Green
        .setTimestamp()
        .setThumbnail(user.displayAvatarURL());

    // 基本情報
    embed.addFields({
        name: '👤 基本情報',
        value: `ユーザー：${user.tag}\n登録区分：送迎者`,
        inline: false
    });

    // 現在の登録情報
    if (registrationJson?.current) {
        const current = registrationJson.current;
        const info = [
            `**ニックネーム**: ${current.nickname || '未設定'}`,
            `**車種**: ${current.car || '未設定'}`,
            `**区域**: ${current.area || '未設定'}`,
            `**停留場所**: ${current.stop || '未設定'}`,
            `**乗車人数**: ${current.capacity || '未設定'}人`,
            `**登録日時**: ${formatDate(current.registeredAt)}`
        ].join('\n');

        embed.addFields({ name: '📌 現在の登録情報', value: info, inline: false });
    }

    addHistoryFields(embed, registrationJson.history, 'driver');
    return embed;
}

/**
 * 利用者用 登録情報Embedを生成
 */
function buildUserRegistrationEmbed(registrationJson, user) {
    const embed = new EmbedBuilder()
        .setTitle('📋 利用者 登録情報')
        .setColor(0x3498db) // Blue
        .setTimestamp()
        .setThumbnail(user.displayAvatarURL());

    // 基本情報
    embed.addFields({
        name: '👤 基本情報',
        value: `ユーザー：${user.tag}\n登録区分：利用者`,
        inline: false
    });

    // 現在の登録情報
    if (registrationJson?.current) {
        const current = registrationJson.current;
        const info = [
            `**店舗名 / ニックネーム**: ${current.storeName || '未設定'}`,
            `**店舗住所**: ${current.address || '未設定'}`,
            `**駐車目印**: ${current.mark || '未設定'}`,
            `**登録日時**: ${formatDate(current.registeredAt)}`
        ].join('\n');

        embed.addFields({ name: '📌 現在の登録情報', value: info, inline: false });
    }

    addHistoryFields(embed, registrationJson.history, 'user');
    return embed;
}

/**
 * 履歴フィールドを追加するヘルパー
 */
function addHistoryFields(embed, history, role) {
    if (!history || history.length === 0) return;

    // ユーザー要望により直近の1件のみ表示
    const latestHistory = history.slice(0, 1);

    latestHistory.forEach((item, index) => {
        let info = '';
        if (role === 'driver') {
            info = [
                `ニックネーム: ${item.nickname || '-'}`,
                `車種: ${item.car || '-'}`,
                `区域: ${item.area || '-'}`,
                `停留場所: ${item.stop || '-'}`,
                `乗車人数: ${item.capacity || '-'}人`
            ].join('\n');
        } else {
            info = [
                `店舗名: ${item.storeName || '-'}`,
                `店舗住所: ${item.address || '-'}`,
                `駐車目印: ${item.mark || '-'}`
            ].join('\n');
        }

        if (item.oldRegisteredAt && item.changedAt) {
            info += `\n有効期間: ${formatDate(item.oldRegisteredAt)} 〜 ${formatDate(item.changedAt)}`;
        }

        embed.addFields({
            name: `🕒 過去の登録情報 ${index + 1}`,
            value: info,
            inline: false
        });
    });
}

function formatDate(isoString) {
    if (!isoString) return '不明';
    return new Date(isoString).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

module.exports = {
    buildDriverRegistrationEmbed,
    buildUserRegistrationEmbed
};
