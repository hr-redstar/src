/**
 * スレッド期間の範囲を計算（月曜起点・日曜締め）
 * @param {Date} date - 基準日時（登録日時）
 * @param {number} weeks - 週数（1, 2, 4, 26）
 * @returns {Object} { start, end } - 開始日時と終了日時
 */
function getThreadRange(date, weeks) {
    const d = new Date(date);

    // 月曜を週の開始にする（0=日,1=月,...）
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const start = new Date(d);
    start.setDate(d.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + weeks * 7 - 1);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}

/**
 * range文字列から週数に変換
 * @param {string} range - 期間文字列（'1w', '2w', '1m', '6m'）
 * @returns {number} 週数
 */
function rangeToWeeks(range) {
    const mapping = {
        '1w': 1,
        '2w': 2,
        '1m': 4,
        '6m': 26
    };
    return mapping[range] || 0;
}

/**
 * スレッド名を生成
 * @param {Date} start - 開始日
 * @param {Date} end - 終了日
 * @returns {string} スレッド名
 */
function formatThreadName(start, end) {
    const f = d =>
        `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

    return `${f(start)}～${f(end)} メモ`;
}

module.exports = {
    getThreadRange,
    rangeToWeeks,
    formatThreadName,
};
