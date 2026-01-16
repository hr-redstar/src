const { writeJson, readJson } = require("./ストレージ/ストア共通");
const { updateRegistrationJson } = require("./updateRegistrationJson");
const paths = require("./ストレージ/ストレージパス");

/**
 * 送迎者データを履歴付きで保存
 */
module.exports.saveDriver = async (guildId, userId, data) => {
    const path = paths.driverProfileJson(guildId, userId);
    const existingJson = await readJson(path).catch(() => null);

    // 履歴構造で更新
    const updatedJson = updateRegistrationJson(existingJson, { ...data, userId });

    await writeJson(path, updatedJson);

    // インデックスファイルを更新 (送迎者.json と 送迎者一覧.json)
    const indexPath = paths.guildDriverIndexJson(guildId);
    const ids = await readJson(indexPath, []).catch(() => []);
    if (!ids.includes(userId)) {
        ids.push(userId);
        await writeJson(indexPath, ids);
    }

    const masterPath = paths.driverMasterListJson(guildId);
    const masterIds = await readJson(masterPath, []).catch(() => []);
    if (!masterIds.includes(userId)) {
        masterIds.push(userId);
        await writeJson(masterPath, masterIds);
    }
};

/**
 * 送迎者の最新データを取得（後方互換性）
 */
module.exports.loadDriver = async (guildId, userId) => {
    const path = paths.driverProfileJson(guildId, userId);
    const json = await readJson(path).catch(() => null);
    if (!json) return null;

    // current構造がある場合はそれを返す、ない場合は旧形式として全体を返す
    return json.current || json;
};

/**
 * 送迎者の完全なJSON（履歴含む）を取得
 */
module.exports.loadDriverFull = async (guildId, userId) => {
    const path = paths.driverProfileJson(guildId, userId);
    return await readJson(path).catch(() => null);
};
