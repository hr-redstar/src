async function editPanelMessage(guild, panel, payload) {
  if (!panel?.channelId || !panel?.messageId) return false;
  const ch = await guild.channels.fetch(panel.channelId).catch(() => null);
  if (!ch) return false;
  const msg = await ch.messages.fetch(panel.messageId).catch(() => null);
  if (!msg) return false;
  await msg.edit(payload);
  return true;
}

module.exports = { editPanelMessage };