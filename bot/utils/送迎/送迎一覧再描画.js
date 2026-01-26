// utils/送迎/送迎一覧再描画.js
const buildPanelEmbed = require('../embed/embedTemplate');

async function buildListEmbed(client, title, list, noteLine = '') {
  const desc = list.length === 0 ? '（該当なし）' : list.map(formatRow).join('\n');
  return buildPanelEmbed({
    title,
    description: desc + (noteLine ? `\n\n${noteLine}` : ''),
    type: 'info',
    client
  });
}

/**
 * registry に保存されている「送迎一覧パネル」固定メッセージを更新する
 * mode: all/open/matched/completed/expired
 */
async function refreshRideListPanel(client, guildId, mode = 'all', noteLine = '') {
  if (!guildId) return { ok: false, reason: 'no_guild' };

  const ref = await panelRegistry.getRideListPanel(guildId);
  if (!ref) return { ok: false, reason: 'not_set' };

  let channel;
  try {
    channel = await client.channels.fetch(ref.channelId);
  } catch {
    return { ok: false, reason: 'channel_fetch_failed' };
  }
  if (!channel || !channel.isTextBased()) return { ok: false, reason: 'not_text_channel' };

  let msg;
  try {
    msg = await channel.messages.fetch(ref.messageId);
  } catch {
    return { ok: false, reason: 'message_fetch_failed' };
  }

  // 期限切れ反映（必要なら）
  await rideStore.expirePast(new Date()).catch(() => { });

  let title;
  let list;
  if (mode === 'all') {
    // 優先表示を作ってるなら listPriority を使ってOK（無ければ listLatest）
    title = '📋 送迎一覧（最新10件 / 全部）';
    list =
      typeof rideStore.listPriority === 'function'
        ? await rideStore.listPriority(10)
        : await rideStore.listLatest(10);
  } else {
    title = `📋 送迎一覧（${mode} 10件）`;
    list = await rideStore.listByStatus(mode, 10);
  }

  const embed = await buildListEmbed(client, title, list, noteLine);

  try {
    await msg.edit({ embeds: [embed], components: msg.components });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'edit_failed' };
  }
}

module.exports = { refreshRideListPanel };
