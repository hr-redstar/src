/**
 * ユーザーメモチャンネルのTopic（説明文）を生成
 * @param {string} userId - DiscordユーザーID
 * @returns {string} チャンネルTopic
 */
function buildUserMemoTopic(userId) {
    return [
        'このチャンネルは、あなた専用のプライベートメモです。',
        '登録情報の履歴や、登録時の変更点が自動で記録されます。',
        '',
        '・過去と現在の登録情報は最初のメッセージで確認できます',
        '・履歴が増えた場合、選択した期間ごとにスレッドへ自動整理されます',
        '・このチャンネルは他のユーザーには表示されません',
        '',
        '※ 操作は不要です。メモとして自由に利用してください。',
        '',
        `USER_ID=${userId}`,
    ].join('\n');
}

module.exports = {
    buildUserMemoTopic,
};
