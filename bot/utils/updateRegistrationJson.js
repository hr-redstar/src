/**
 * 登録JSONを履歴保存形式で更新
 * @param {Object|null} existingJson - 既存のJSON（なければnull）
 * @param {Object} newData - 新しい登録データ
 * @returns {Object} 更新されたJSON（current + history構造）
 */
function updateRegistrationJson(existingJson, newData) {
    const now = new Date().toISOString();

    // 初回登録
    if (!existingJson || !existingJson.current) {
        return {
            userId: newData.userId,
            current: {
                ...newData,
                registeredAt: now,
            },
            history: [],
            registrationMessageId: null, // 初回登録メッセージID（後で設定）
        };
    }

    // 再登録:currentを historyに移動して新データで更新
    return {
        userId: existingJson.userId,
        current: {
            ...newData,
            registeredAt: now,
        },
        history: [
            ...existingJson.history,
            {
                ...existingJson.current,
                oldRegisteredAt: existingJson.current.registeredAt,
                changedAt: now,
            },
        ],
        registrationMessageId: existingJson.registrationMessageId, // メッセージIDを保持
    };
}

module.exports = {
    updateRegistrationJson,
};
