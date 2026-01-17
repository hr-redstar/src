/**
 * プライベートVCガイドメッセージを生成
 * @param {CategoryChannel} category - カテゴリーチャンネル
 * @returns {Object} メッセージペイロード
 */
function buildPrivateVcGuide(category) {
  const categoryName = category ? category.name : 'このカテゴリー';

  return {
    content: {
      embeds: [
        {
          title: '📝 プライベートVCの使い方',
          description:
            `送迎がマッチングされた際に、カテゴリー：${categoryName} に\n` +
            '送迎者と利用者専用のプライベートVCチャンネル が自動で作成されます。\n\n' +
            '待ち合わせや、落とし物のやり取りなどにご利用ください。\n\n' +
            '**ご利用にあたって**\n' +
            '• 送迎終了後、**7日間保存**されます\n' +
            '• 必要に応じて **「期間延長」ボタン** で保存期間を延長できます\n\n' +
            '※ 管理者が内容を閲覧することはありません。',
          color: 0x3498db,
        },
      ],
    },
    topic: `送迎マッチング時に、カテゴリー：${categoryName} へ送迎者・利用者専用のプライベートVCが自動作成されます。送迎終了後は7日間保存されます。`,
  };
}

module.exports = {
  buildPrivateVcGuide,
};
