const { readJson, writeJson } = require('./ストレージ/ストア共通');

/**
 * 登録情報メッセージIDを保存
 * @param {string} guildId - ギルドID
 * @param {string} userId - ユーザーID
 * @param {string} messageId - メッセージID
 * @param {string} role - 役割 ('driver' または 'user')
 */
async function saveRegistrationMessageId(guildId, userId, messageId, role = 'driver') {
    const { driverProfileJson, userProfileJson } = require('./ストレージ/ストレージパス');
    const basePath = role === 'driver' ? driverProfileJson(guildId, userId) : userProfileJson(guildId, userId);
    const json = await readJson(basePath).catch(() => null);

    if (!json) return;

    json.registrationMessageId = messageId;
    await writeJson(basePath, json);
}

/**
 * 登録情報メッセージIDを取得
 * @param {string} guildId - ギルドID
 * @param {string} userId - ユーザーID
 * @param {string} role - 役割 ('driver' または 'user')
 * @returns {string|null} メッセージID
 */
async function getRegistrationMessageId(guildId, userId, role = 'driver') {
    const { driverProfileJson, userProfileJson } = require('./ストレージ/ストレージパス');
    const basePath = role === 'driver' ? driverProfileJson(guildId, userId) : userProfileJson(guildId, userId);
    const json = await readJson(basePath).catch(() => null);

    return json?.registrationMessageId || null;
}

module.exports = {
    saveRegistrationMessageId,
    getRegistrationMessageId,
};
