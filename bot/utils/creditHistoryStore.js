const store = require('./ストレージ/ストア共通');

/**
 * クレジットの取引履歴を記録する
 * @param {string} guildId
 * @param {string} userId
 * @param {Object} entry { amount, type, reason, balance }
 */
async function logCreditTransaction(guildId, userId, { amount, type, reason, balance }) {
    const path = `guilds/${guildId}/利用者/${userId}/クレジット履歴.json`;

    await store.updateJson(path, (existing) => {
        const history = Array.isArray(existing) ? existing : [];
        const newEntry = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
            timestamp: new Date().toISOString(),
            amount,   // 増減額 (+500, -300など)
            type,     // 'charge', 'ride_fee', 'carpool_fee', 'manual_adj' など
            reason,   // 'クレジット補充', '送迎利用料', '相乗り利用料'
            balance   // 取引後の残高
        };

        history.unshift(newEntry); // 新しい順

        // 最大100件まで保持
        return history.slice(0, 100);
    });
}

/**
 * クレジット履歴を取得する
 */
async function getCreditHistory(guildId, userId, limit = 10) {
    const path = `guilds/${guildId}/利用者/${userId}/クレジット履歴.json`;
    const history = await store.readJson(path, []).catch(() => []);
    return history.slice(0, limit);
}

module.exports = {
    logCreditTransaction,
    getCreditHistory
};
