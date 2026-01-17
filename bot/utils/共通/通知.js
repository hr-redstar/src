async function notifyUser(client, userId, message, fallbackChannel) {
  // 1) DM
  try {
    const user = await client.users.fetch(userId);
    await user.send(message);
    return { ok: true, via: 'dm' };
  } catch {}

  // 2) フォールバック：チャンネル（可能なら）
  try {
    if (fallbackChannel) {
      await fallbackChannel.send(`<@${userId}> ${message}`);
      return { ok: true, via: 'channel' };
    }
  } catch {}

  return { ok: false };
}

module.exports = { notifyUser };
