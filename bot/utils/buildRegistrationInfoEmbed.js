const buildPanelEmbed = require('./embed/embedTemplate');

/**
 * 送迎者用 登録情報Embedを生成 (v2.0.0)
 */
function buildDriverRegistrationEmbed(registrationJson, user, userRanks = {}) {
  const current = registrationJson?.current || {};

  // ランク・評価情報の取得
  const rank = userRanks[user.id] || current.rank || 'ブロンズ'; // Global優先
  const rating = current.rating || 0;
  const ratingCount = current.ratingCount || 0;
  const stars = '⭐'.repeat(Math.round(rating)) || 'ー';

  const embed = buildPanelEmbed({
    title: '📋 送迎者 登録情報',
    color: 0x2ecc71, // Green
    client: user.client,
    thumbnail: user.displayAvatarURL(),
    fields: [
      {
        name: '👤 送迎者情報',
        value: `<@${user.id}>\n👑 **${rank}**\n${stars} (${rating.toFixed(2)})`,
        inline: false,
      },
      {
        name: '📌 最新の登録内容',
        value: [
          `**ニックネーム**: ${current.nickname || '未設定'}`,
          `**車種/カラー/ナンバー**: ${current.car || '未設定'}`,
          `**乗車人数**: ${current.capacity || '未設定'}名`,
          `**whooID**: ${current.whooId || '未設定'}`,
          `**更新日時**: ${formatDate(current.registeredAt)}`,
        ].join('\n'),
        inline: false
      }
    ]
  });

  addHistoryFields(embed, registrationJson.history, 'driver');
  return embed;
}

/**
 * 利用者用 登録情報Embedを生成 (v2.0.0)
 */
function buildUserRegistrationEmbed(registrationJson, user, userRanks = {}) {
  const current = registrationJson?.current || {};

  // ランク・評価情報の取得
  const rank = userRanks[user.id] || current.rank || 'ブロンズ';
  const rating = current.rating || 0;
  const ratingCount = current.ratingCount || 0;
  const stars = '⭐'.repeat(Math.round(rating)) || 'ー';

  const embed = buildPanelEmbed({
    title: '📋 利用者 登録情報',
    color: 0x3498db, // Blue
    client: user.client,
    thumbnail: user.displayAvatarURL(),
    fields: [
      {
        name: '👤 利用者情報',
        value: `<@${user.id}>\n👑 **${rank}**\n${stars} (${rating.toFixed(2)})`,
        inline: false,
      },
      {
        name: '📌 最新の登録内容',
        value: [
          `**店舗名 / ニックネーム**: ${current.storeName || '未設定'}`,
          `**店舗住所**: ${current.address || '未設定'}`,
          `**駐車目印**: ${current.mark || '未設定'}`,
          `**更新日時**: ${formatDate(current.registeredAt)}`,
        ].join('\n'),
        inline: false
      }
    ]
  });

  addHistoryFields(embed, registrationJson.history, 'user');
  return embed;
}

/**
 * 履歴フィールドを追加するヘルパー
 */
function addHistoryFields(embed, history, role) {
  if (!history || history.length === 0) return;

  // ユーザー要望により直近の1件のみ表示
  // historyは古い順にpushされるため、reverseして最新を取得
  const latestHistory = [...history].reverse().slice(0, 1);

  latestHistory.forEach((item, index) => {
    let info = '';
    if (role === 'driver') {
      info = [
        `ニックネーム: ${item.nickname || '-'}`,
        `車種/カラー/ナンバー: ${item.car || '-'}`,
        `乗車人数: ${item.capacity || '-'}人`,
        `whooID: ${item.whooId || '-'}`,
      ].join('\n');
    } else {
      info = [
        `店舗名: ${item.storeName || '-'}`,
        `店舗住所: ${item.address || '-'}`,
        `駐車目印: ${item.mark || '-'}`,
      ].join('\n');
    }

    if (item.oldRegisteredAt && item.changedAt) {
      info += `\n有効期間: ${formatDate(item.oldRegisteredAt)} 〜 ${formatDate(item.changedAt)}`;
    }

    embed.addFields({
      name: `🕒 過去の登録情報 ${index + 1}`,
      value: info,
      inline: false,
    });
  });
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
  buildDriverRegistrationEmbed,
  buildUserRegistrationEmbed,
};
