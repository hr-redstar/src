const { ChannelType } = require("discord.js");

async function logToAdminChannel(guild, cfg, content) {
  const id = cfg.channels?.adminLogChannelId;
  if (!id) return;
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (!ch || ch.type !== ChannelType.GuildText) return;
  await ch.send({ content });
}

module.exports = { logToAdminChannel };