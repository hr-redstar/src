// src/bot/utils/共通/visibilityManager.js
const { PermissionFlagsBits } = require('discord.js');
const logger = require('../logger');

/**
 * チャンネルまたはスレッドの公開状況を制御する
 * 
 * @param {import('discord.js').GuildChannel | import('discord.js').AnyThreadChannel} channel 
 * @param {string|null} operatorRoleId 運営者ロールID
 */
async function applyVisibility(channel, operatorRoleId) {
    try {
        if (!operatorRoleId) {
            // ロール未設定の場合：全員に見えるように（ViewChannel を Inherit または True に戻す）
            // スレッドの場合は少し挙動が異なるが、基本は @everyone の権限をリセット、もしくは許可
            await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
                ViewChannel: null, // デフォルトに戻す
            });
            logger.info(`公開制限解除: ${channel.name} (ロール未設定のため)`);
            return;
        }

        // ロール設定済みの場合：プライベート化
        // 1. @everyone から ViewChannel 権限を奪う
        await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
            ViewChannel: false,
        });

        // 2. 運営者ロールに ViewChannel 権限を与える
        await channel.permissionOverwrites.edit(operatorRoleId, {
            ViewChannel: true,
            SendMessages: true, // 運営者はメッセージ可能
        });

        logger.info(`プライベート化適用: ${channel.name} (運営者ロール: ${operatorRoleId})`);
    } catch (error) {
        logger.error(`公開制限適用失敗: ${channel.name}, error=${error.message}`);
    }
}

/**
 * 複数のチャンネル/スレッドに一括適用
 */
async function applyVisibilityToAll(guild, channels, operatorRoleId) {
    for (const channel of channels) {
        if (channel) await applyVisibility(channel, operatorRoleId);
    }
}

module.exports = {
    applyVisibility,
    applyVisibilityToAll,
};
