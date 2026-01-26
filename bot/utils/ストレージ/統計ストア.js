// src/bot/utils/ストレージ/統計ストア.js
const store = require('./ストア共通');
const paths = require('./ストレージパス');

/**
 * 統計情報を更新する
 * @param {string} guildId 
 * @param {string} type 'ride' | 'carpool' | 'user_active' など
 * @param {number} delta 増分（通常 1）
 */
async function incrementStat(guildId, type, delta = 1) {
    const path = paths.statsJson(guildId);
    await store.updateJson(path, (data) => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const ym = `${y}-${m}`;
        const ymd = `${y}-${m}-${d}`;
        const h = String(now.getHours()).padStart(2, '0');
        const hKey = `${ymd} ${h}:00`;

        const stats = data || {
            cumulative: {},
            monthly: {},
            daily: {},
            hourly: {},
        };

        // 1. 累計
        stats.cumulative[type] = (stats.cumulative[type] || 0) + delta;

        // 2. 月次
        if (!stats.monthly[ym]) stats.monthly[ym] = {};
        stats.monthly[ym][type] = (stats.monthly[ym][type] || 0) + delta;

        // 3. 日次
        if (!stats.daily[ymd]) stats.daily[ymd] = {};
        stats.daily[ymd][type] = (stats.daily[ymd][type] || 0) + delta;

        // 4. 時次 (v2.9.2)
        if (!stats.hourly) stats.hourly = {};
        if (!stats.hourly[hKey]) stats.hourly[hKey] = {};
        stats.hourly[hKey][type] = (stats.hourly[hKey][type] || 0) + delta;

        // 古いデータの掃除（任意：直近3ヶ月分だけ残すなど）
        const months = Object.keys(stats.monthly).sort();
        if (months.length > 24) { // 2年分
            delete stats.monthly[months[0]];
        }
        const days = Object.keys(stats.daily).sort();
        if (days.length > 90) { // 3ヶ月分
            delete stats.daily[days[0]];
        }
        const hours = Object.keys(stats.hourly).sort();
        if (hours.length > 168) { // 1週間分 (24 * 7)
            delete stats.hourly[hours[0]];
        }

        return stats;
    });
}

/**
 * 統計情報を取得する
 * @param {string} guildId 
 */
async function getStats(guildId) {
    return await store.readJson(paths.statsJson(guildId)) || {
        cumulative: {},
        monthly: {},
        daily: {},
    };
}

module.exports = {
    incrementStat,
    getStats,
};
