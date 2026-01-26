// handler/自動設定/setupUtils.js
const { ChannelType, PermissionFlagsBits } = require('discord.js');

/**
 * べき等なカテゴリー作成
 */
async function ensureCategory(guild, name, permissionOverwrites = []) {
    const existing = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === name
    );
    if (existing) return { channel: existing, status: 'skipped' };

    const created = await guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        permissionOverwrites,
    });
    return { channel: created, status: 'created' };
}

/**
 * べき等なテキストチャンネル作成
 */
async function ensureTextChannel(guild, name, parent, permissionOverwrites = []) {
    const existing = guild.channels.cache.find(
        (c) =>
            c.type === ChannelType.GuildText &&
            c.name === name &&
            c.parentId === parent?.id
    );
    if (existing) return { channel: existing, status: 'skipped' };

    const created = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: parent?.id,
        permissionOverwrites,
    });
    return { channel: created, status: 'created' };
}

/**
 * 運営者/管理者のみ閲覧可能な権限設定を取得
 */
function getAdminOnlyPermissions(guild, operatorRoleId) {
    const overwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
    ];

    if (operatorRoleId) {
        overwrites.push({
            id: operatorRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
    }

    return overwrites;
}

/**
 * 利用者は閲覧のみ、BOTのみ投稿可能な権限設定を取得
 */
function getReadOnlyPermissions(guild, userRoleId) {
    const overwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.SendMessages],
        },
    ];
    if (userRoleId) {
        overwrites.push({
            id: userRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages]
        });
    }
    return overwrites;
}

module.exports = {
    ensureCategory,
    ensureTextChannel,
    getAdminOnlyPermissions,
    getReadOnlyPermissions,
};
