const { EmbedBuilder } = require('discord.js');
const { postAdminActionLog } = require('./管理者ログ');

/**
 * 設定の差分を計算してログを出力する
 */
function getDiffDescription(oldVal, newVal, label) {
    if (oldVal === newVal) return null;
    const oldText = oldVal ? `<#${oldVal}>` : '未設定';
    const newText = newVal ? `<#${newVal}>` : '未設定';
    return `${label}：${oldText} → ${newText}`;
}

function getRoleDiffDescription(oldRoles = [], newRoles = []) {
    const oldSet = new Set(oldRoles.map(String));
    const newSet = new Set(newRoles.map(String));
    const added = [...newSet].filter(x => !oldSet.has(x));
    const removed = [...oldSet].filter(x => !newSet.has(x));

    if (added.length === 0 && removed.length === 0) return null;

    let desc = '';
    if (added.length > 0) desc += `追加：${added.map(id => `<@&${id}>`).join(' ')}\n`;
    if (removed.length > 0) desc += `削除：${removed.map(id => `<@&${id}>`).join(' ')}\n`;
    return desc.trim();
}

/**
 * パネル設置時の差分ログ
 */
async function logPanelInstallDiff({ guild, user, panelName, oldChannelId, newChannelId }) {
    if (oldChannelId === newChannelId && oldChannelId !== undefined) return;

    await postAdminActionLog({
        guild,
        user,
        title: `[${panelName}] が設置されました`,
        description: `設置先チャンネル：<#${newChannelId}>`,
    });
}

/**
 * 一般的な設定変更の差分ログ
 */
async function logConfigChange({ guild, user, title, oldConfig, newConfig, mapping }) {
    const lines = [];
    for (const [key, label] of Object.entries(mapping)) {
        // 構造化されたキー (例: logs.globalChannel) に対応
        const keys = key.split('.');
        let ov = oldConfig;
        let nv = newConfig;
        for (const k of keys) {
            ov = ov?.[k];
            nv = nv?.[k];
        }

        const diff = Array.isArray(ov)
            ? getRoleDiffDescription(ov, nv)
            : getDiffDescription(ov, nv, label);

        if (diff) lines.push(diff);
    }

    if (lines.length === 0) return;

    await postAdminActionLog({
        guild,
        user,
        title,
        description: lines.join('\n'),
    });
}

module.exports = {
    logPanelInstallDiff,
    logConfigChange,
};
