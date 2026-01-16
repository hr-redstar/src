/**
 * 個人メモガイドメッセージを生成
 * @param {CategoryChannel} category - カテゴリーチャンネル
 * @returns {Object} メッセージペイロード
 */
function buildUserMemoGuide(category) {
    return {
        content: {
            embeds: [
                {
                    title: '📝 個人メモの使い方',
                    description:
                        'このチャンネルは **あなた専用の送迎メモ** です。\n' +
                        'ユーザー登録時、自動で作成されます。\n\n' +
                        '**ご利用にあたって**\n' +
                        '• 送迎に関するメモを自由に記録できます\n' +
                        '• VCでのやり取りが自動転送される場合があります\n' +
                        '• 他ユーザーと共有したい場合は @メンションで追加できます\n\n' +
                        '※ 運営が強制参加することはありません。',
                    color: 0x95a5a6,
                },
            ],
        },
        topic: 'このチャンネルはあなた専用の送迎メモです。ユーザー登録時に自動作成されます。'
    };
}

module.exports = {
    buildUserMemoGuide,
};
