const { loadConfig, saveConfig } = require('../../../utils/設定/設定マネージャ');
const { sendOrUpdatePanel } = require('../../共通/パネル送信');
const { postAdminActionLog } = require('../../../utils/ログ/管理者ログ');

/**
 * パネルを別のチャンネルへ移動するテンプレート関数
 */
async function movePanel({
    interaction,
    panelKey,
    panelName,
    newChannel,
    buildMessage,
}) {
    const guild = interaction.guild;
    const config = await loadConfig(guild.id);

    const old = config.panelMessages?.[panelKey];

    // 新チャンネルへ送信 or 更新
    // 移動時は確実に「新規送信」したい場合が多いが、
    // sendOrUpdatePanel の messageId に null を渡せば新規送信になる
    const messageId = await sendOrUpdatePanel({
        channel: newChannel,
        messageId: null,
        buildMessage,
    });

    if (!messageId) return false;

    // 旧パネル削除
    if (old?.channelId && old?.messageId) {
        try {
            const oldChannel = await guild.channels.fetch(old.channelId);
            const msg = await oldChannel.messages.fetch(old.messageId);
            await msg.delete().catch(() => null);
        } catch {
            /* 無視 */
        }
    }

    // 設定更新
    config.panelMessages ??= {};
    config.panelMessages[panelKey] = {
        channelId: newChannel.id,
        messageId,
    };

    await saveConfig(guild.id, config);

    // ログ出力
    await postAdminActionLog({
        guild,
        user: interaction.user,
        title: `${panelName}移動`,
        description: `新設置先： <#${newChannel.id}>`,
    });

    return true;
}

module.exports = { movePanel };
