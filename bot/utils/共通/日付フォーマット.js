// utils/共通/日付フォーマット.js
/**
 * 日付を短縮形式でフォーマット (MM/DD HH:mm)
 */
function formatDateShort(date) {
  return date.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}

module.exports = { formatDateShort };
