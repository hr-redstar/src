const { ChannelType, ThreadAutoArchiveDuration, EmbedBuilder } = require('discord.js');

/**
 * 古い履歴を「昔の登録情報」スレッドに投稿する
 * @param {import('discord.js').TextChannel} channel - 親チャンネル
 * @param {Object} history - 履歴配列
 * @param {string} role - 役割 ('driver' / 'user')
 */
async function postOldHistoryToThread(channel, history, role) {
  if (!history || history.length <= 1) return;

  // 最新の1件(=末尾)を除く、古い履歴を対象にする
  // historyは [oldest, ..., newest] の順
  const targetHistories = history.slice(0, -1);
  if (targetHistories.length === 0) return;

  try {
    // スレッドの取得または作成
    let thread = channel.threads.cache.find((t) => t.name === '昔の登録情報');
    if (!thread) {
      // アクティブでない場合も考慮してfetch
      const fetched = await channel.threads.fetch();
      thread = fetched.threads.find((t) => t.name === '昔の登録情報');
    }

    if (!thread) {
      thread = await channel.threads.create({
        name: '昔の登録情報',
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        reason: '古い登録履歴の保存用',
      });
    }

    // スレッドがアーカイブされていたら復元
    if (thread.archived) {
      await thread.setArchived(false);
    }

    // 重複チェックのために直近のメッセージを取得
    const messages = await thread.messages.fetch({ limit: 20 });

    for (const item of targetHistories) {
      // 有効期間の文字列を作成（これをキーにする）
      const rangeText = `有効期間: ${formatDate(item.oldRegisteredAt)} 〜 ${formatDate(item.changedAt)}`;

      // 既に同じ有効期間の履歴が投稿されているかチェック
      const isDuplicate = messages.some((msg) => {
        if (!msg.embeds.length) return false;
        const embed = msg.embeds[0];

        // Description から rangeText を探す
        if (embed.description?.includes(rangeText)) return true;

        // Fields から rangeText を探す
        if (embed.fields?.some((f) => f.value.includes(rangeText))) return true;

        return false;
      });

      if (isDuplicate) continue;

      // Embed作成
      const embed = buildHistoryEmbed(item, role, rangeText);
      await thread.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('古い履歴のスレッド投稿に失敗:', err);
  }
}

/**
 * 履歴用Embedの生成
 */
function buildHistoryEmbed(item, role, rangeText) {
  const embed = new EmbedBuilder()
    .setTitle('🕒 過去の登録情報')
    .setColor(0x95a5a6) // Gray
    .setTimestamp(new Date(item.changedAt)); // 変更日時をタイムスタンプに

  let info = '';
  if (role === 'driver') {
    info = [
      `**ニックネーム**: ${item.nickname || '-'}`,
      `**車種**: ${item.car || '-'}`,
      `**区域**: ${item.area || '-'}`,
      `**停留場所**: ${item.stop || '-'}`,
      `**乗車人数**: ${item.capacity || '-'}人`,
    ].join('\n');
  } else {
    info = [
      `**店舗名 / ニックネーム**: ${item.storeName || '-'}`,
      `**目印**: ${item.mark || '-'}`,
    ].join('\n');
  }

  info += `\n\n${rangeText}`;

  embed.setDescription(info);
  return embed;
}

function formatDate(isoString) {
  if (!isoString) return '不明';
  return new Date(isoString).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

module.exports = {
  postOldHistoryToThread,
};
