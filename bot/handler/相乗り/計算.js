/**
 * 空き座席数を算出する
 * 
 * @param {number} driverCapacity 送迎者の最大乗車人数
 * @param {number} currentUsers 現在の乗車人数（メイン利用者1人 + 承認済み相乗り人数）
 * @returns {number} 残り座席数
 */
function calcAvailableSeats(driverCapacity, currentUsers) {
    return Math.max(driverCapacity - currentUsers, 0);
}

module.exports = { calcAvailableSeats };
