/**
 * 登録情報をメモチャンネルへ追記形式で反映
 * @param {TextChannel} channel - メモチャンネル
 * @param {Object} registrationData - 登録データ
 * @param {string} role - 役割 ('driver' または 'user')
 * @param {boolean} isReregistration - 再登録かどうか
 */
async function reflectRegistrationData(channel, registrationData, role = 'driver', isReregistration = false) {
    if (!channel || !registrationData) return;

    const timestamp = new Date().toLocaleString('ja-JP');
    const title = isReregistration ? '🔄 現在の登録情報 更新' : '📥 登録情報（初回登録）';

    let content = `
────────────────────
${title}
────────────────────
`;

    // 送迎者の場合
    if (role === 'driver') {
        content += `・ニックネーム：${registrationData.nickname || '未入力'}
・車種：${registrationData.car || '未入力'}
・対応エリア（区域）：${registrationData.area || '未入力'}
・停留場所：${registrationData.stop || '未入力'}
・乗車人数：${registrationData.capacity || '未入力'}`;
    }
    // 利用者の場合
    else if (role === 'user') {
        content += `・店舗名：${registrationData.storeName || '未入力'}
・目印：${registrationData.mark || '未入力'}`;
    }
    // 汎用（将来拡張用）
    else {
        for (const [key, value] of Object.entries(registrationData)) {
            content += `・${key}：${value || '未入力'}\n`;
        }
    }

    content += `

・登録日時：${timestamp}`;

    await channel.send({ content: content.trim() });
}

module.exports = {
    reflectRegistrationData,
};
