const { sendOrUpdatePanel } = require('../../共通/パネル送信');
const { loadConfig, saveConfig } = require('../../../utils/設定/設定マネージャ');

/**
 * パネルを設置（送信・更新・保存・ログ）するテンプレート関数
 */
async function installPanel({
  interaction,
  panelKey,
  channelId, // 直接IDを指定する場合
  channel, // 規格化前の互換性用
  buildMessage,
  panelName,
  skipMessage = false, // 明示的にメッセージ送信をスキップする場合
}) {
  const guild = interaction.guild;
  const config = await loadConfig(guild.id);

  // チャンネルIDの特定
  const targetChannelId = channelId || channel?.id;
  if (!targetChannelId) return false;

  // パネルの送信（旧パネルがあれば削除を試みる）
  const panel = config.panels?.[panelKey];
  let oldMessageId = panel?.messageId || null;
  let messageId = oldMessageId;

  if (buildMessage && !skipMessage) {
    const targetChannel =
      channel || (await guild.channels.fetch(targetChannelId).catch(() => null));
    if (targetChannel) {
      // 旧メッセージ削除
      if (oldMessageId) {
        const oldMsg = await targetChannel.messages.fetch(oldMessageId).catch(() => null);
        if (oldMsg) await oldMsg.delete().catch(() => null);
      }

      // 新規送信
      const payload = await buildMessage();
      const newMsg = await targetChannel.send(payload).catch(() => null);
      if (!newMsg) return false;

      messageId = newMsg.id;
    }
  }

  // 設定の保存
  config.panels ??= {};
  config.panels[panelKey] = {
    channelId: targetChannelId,
    messageId: messageId,
  };

  await saveConfig(guild.id, config);

  // 管理者ログの出力
  const { logPanelInstallDiff } = require('../../../utils/ログ/差分ログ');
  await logPanelInstallDiff({
    guild,
    user: interaction.user,
    panelName,
    oldChannelId: panel?.channelId,
    newChannelId: targetChannelId,
  });

  return true;
}

module.exports = { installPanel };
