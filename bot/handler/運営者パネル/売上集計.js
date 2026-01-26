const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 送迎利用料の月次集計を行う
 */
async function aggregateMonthlyRevenue(guildId, year, month, includeDetails = false) {
    const mm = String(month).padStart(2, '0');
    const historyDir = `${guildId}/送迎履歴/${year}/${mm}`;

    try {
        // 全ての日付ファイルをリストアップ
        const files = await listAllFilesRecursive(historyDir);
        const historyFiles = files.filter(f => f.endsWith('_送迎履歴.json'));

        let totalRevenue = 0;
        let rideCount = 0;
        const records = [];

        for (const file of historyFiles) {
            const historyData = await store.readJson(file).catch(() => ({}));
            // historyData は { rideId: { fee, totalRevenue, ... } } の形式
            for (const ride of Object.values(historyData)) {
                // v2.9.2+: totalRevenue (メイン+相乗り) を優先、なければ単体 fee
                const revenue = ride.totalRevenue !== undefined ? ride.totalRevenue : (ride.fee || 0);
                totalRevenue += parseInt(revenue) || 0;
                rideCount++;

                if (includeDetails) {
                    records.push({
                        rideId: ride.rideId,
                        timestamp: ride.timestamp || ride.completedAt,
                        driverId: ride.driverId,
                        userId: ride.userId,
                        revenue: parseInt(revenue) || 0,
                        carpoolCount: ride.carpoolUsers?.length || 0,
                        area: ride.area || '不明'
                    });
                }
            }
        }

        return { totalRevenue, rideCount, year, month, records: includeDetails ? records : undefined };
    } catch (error) {
        console.error('売上集計エラー:', error);
        return { totalRevenue: 0, rideCount: 0, year, month, records: [] };
    }
}

/**
 * 特定のディレクトリ以下の全ファイルを再帰的に取得 (簡易版)
 */
async function listAllFilesRecursive(dir) {
    const results = [];
    const keys = await store.listKeys(dir).catch(() => []);

    for (const key of keys) {
        // GCS等でディレクトリが末尾 / で終わる場合は再帰
        if (key.endsWith('/')) {
            const sub = await listAllFilesRecursive(key);
            results.push(...sub);
        } else {
            results.push(key);
        }
    }
    return results;
}

/**
 * 月次詳細レポートをテキスト形式で生成する
 */
async function exportMonthlyReport(guild, year, month) {
    const { records, totalRevenue, rideCount } = await aggregateMonthlyRevenue(guild.id, year, month, true);

    if (!records || records.length === 0) {
        return "指定された期間の稼働データはありませんでした。";
    }

    // ユーザー情報のキャッシュ
    const { loadDriver } = require('../../utils/driversStore');
    const { loadUser } = require('../../utils/usersStore');

    const lines = [
        `===========================================`,
        `   送迎システム 月次稼働詳細レポート (${year}年${month}月)`,
        `===========================================`,
        `集計期間: ${year}/${month}/01 ～ 月末`,
        `総稼働件数: ${rideCount} 件`,
        `総回収利用料: ￥${totalRevenue.toLocaleString()}`,
        `-------------------------------------------`,
        `日付/時刻 | ドライバー | 利用者 | 売上 | 相乗り | 方面`,
        `---------+------------+--------+------+--------+-------`
    ];

    // 日付昇順でソート
    records.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (const r of records) {
        const dt = new Date(r.timestamp);
        const dateStr = `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;

        // 名前解決 (簡易)
        const driver = await loadDriver(guild.id, r.driverId).catch(() => null);
        const user = await loadUser(guild.id, r.userId).catch(() => null);

        const dName = driver?.nickname || driver?.name || r.driverId.substring(0, 8);
        const uName = user?.storeName || user?.name || r.userId.substring(0, 8);

        lines.push(`${dateStr.padEnd(10)} | ${dName.substring(0, 6).padEnd(6)} | ${uName.substring(0, 6).padEnd(6)} | ${String(r.revenue).padStart(4)} | ${r.carpoolCount}名 | ${r.area.substring(0, 8)}`);
    }

    lines.push(`-------------------------------------------`);
    lines.push(`レポート生成日: ${new Date().toLocaleString('ja-JP')}`);

    return lines.join('\n');
}

module.exports = { aggregateMonthlyRevenue, exportMonthlyReport };
