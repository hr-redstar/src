const { readJson, writeJson } = require("./ストレージ/ストア共通");

const path = (guildId) => `GCS/${guildId}/vcState.json`;

module.exports.loadVcState = async (guildId) => {
    return await readJson(path(guildId), {});
};

module.exports.saveVcState = async (guildId, state) => {
    await writeJson(path(guildId), state);
};

module.exports.updateVcState = async (guildId, vcId, data) => {
    const state = await module.exports.loadVcState(guildId);
    state[vcId] = { ...state[vcId], ...data };
    await module.exports.saveVcState(guildId, state);
    return state[vcId];
};

module.exports.deleteVcState = async (guildId, vcId) => {
    const state = await module.exports.loadVcState(guildId);
    delete state[vcId];
    await module.exports.saveVcState(guildId, state);
};
