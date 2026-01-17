/**
 * 登録情報メッセージを更新（再登録時に履歴を追加）
 * @param {TextChannel} channel - メモチャンネル
 * @param {string} messageId - 更新するメッセージID
 * @param {Object} registrationJson - 完全な登録JSON（current + history）
 * @param {string} role - 役割 ('driver' または 'user')
 * @param {Object} user - Discordユーザーオブジェクト
 */
async function updateRegistrationInfoMessage(channel, messageId, registrationJson, role, user) {
  if (!channel || !messageId || !registrationJson) return;

  try {
    const message = await channel.messages.fetch(messageId);
    if (!message) return;

    const {
      buildDriverRegistrationEmbed,
      buildUserRegistrationEmbed,
    } = require('./buildRegistrationInfoEmbed');

    let embed;
    if (role === 'driver') {
      embed = buildDriverRegistrationEmbed(registrationJson, user);
    } else {
      embed = buildUserRegistrationEmbed(registrationJson, user);
    }

    // テキストを空にしてEmbedで上書き
    await message.edit({ content: '', embeds: [embed] });

    // 古い履歴をスレッドに退避 (非同期)
    const { postOldHistoryToThread } = require('./postOldHistoryToThread');
    await postOldHistoryToThread(channel, registrationJson.history, role);

    return true;
  } catch (error) {
    if (error.code === 10008) {
      // Unknown Message: メッセージが削除されている
      return false;
    }
    console.error('登録情報メッセージの更新に失敗:', error);
    return false;
  }
}

module.exports = {
  updateRegistrationInfoMessage,
};
