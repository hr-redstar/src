const logger = require('../logger');

/**
 * 設定ファイルの整合性をチェックする
 * @param {import('discord.js').Guild} guild - 対象のギルドオブジェクト
 * @param {Object} config - 設定データ
 */
async function checkConfigIntegrity(guild, config) {
    logger.info(`🔍 設定整合性チェックを開始: Guild=${guild.id} (${guild.name})`);

    const results = {
        valid: 0,
        missing: [],
    };

    // --- ロールチェック ---
    if (config.operatorRoleId) {
        const role = await guild.roles.fetch(config.operatorRoleId).catch(() => null);
        if (!role) {
            results.missing.push(`Role: operatorRoleId (${config.operatorRoleId})`);
        } else {
            results.valid++;
        }
    }

    const roleCategories = [config.roles?.drivers, config.roles?.users];
    for (const roles of roleCategories) {
        if (Array.isArray(roles)) {
            for (const roleId of roles) {
                const role = await guild.roles.fetch(roleId).catch(() => null);
                if (!role) {
                    results.missing.push(`Role: in roles list (${roleId})`);
                } else {
                    results.valid++;
                }
            }
        }
    }

    // --- チャンネル/カテゴリーチェック ---
    const channelKeys = [
        { path: 'categories.privateVc', label: 'Category: privateVc' },
        { path: 'categories.userMemo', label: 'Category: userMemo' },
        { path: 'logs.operatorChannel', label: 'Channel: operatorChannel' },
        { path: 'logs.globalChannel', label: 'Channel: globalChannel' },
        { path: 'logs.errorLogChannel', label: 'Channel: errorLogChannel' },
    ];

    for (const item of channelKeys) {
        const [section, key] = item.path.split('.');
        const id = config[section]?.[key];
        if (id) {
            const channel = await guild.channels.fetch(id).catch(() => null);
            if (!channel) {
                results.missing.push(`${item.label} (${id})`);
            } else {
                results.valid++;
            }
        }
    }

    // --- パネル配置チェック ---
    if (config.panels) {
        for (const [panelName, panelData] of Object.entries(config.panels)) {
            if (panelData?.channelId) {
                const channel = await guild.channels.fetch(panelData.channelId).catch(() => null);
                if (!channel) {
                    results.missing.push(`Panel Channel: ${panelName} (${panelData.channelId})`);
                } else {
                    results.valid++;
                }
            }
        }
    }

    // --- 結果出力 ---
    if (results.missing.length > 0) {
        logger.warn(`⚠️ 設定整合性に不備が見つかりました (${results.missing.length}件の不明なリソース):`);
        results.missing.forEach((msg) => logger.warn(`  - ${msg}`));
        logger.warn('※ これらのリソースが削除されている場合、一部の機能が正常に動作しない可能性があります。');
    } else {
        logger.info(`✅ 設定整合性チェック完了: ${results.valid}件のリソースを確認済み。`);
    }

    return results;
}

module.exports = { checkConfigIntegrity };
