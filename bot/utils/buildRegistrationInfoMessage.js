/**
 * 登録情報メッセージを生成（通常テキスト形式）
 * @param {Object} registrationJson - 完全な登録JSON（current + history）
 * @param {string} role - 役割 ('driver' または 'user')
 * @param {Object} user - Discordユーザーオブジェクト
 * @param {boolean} isReregistration - 再登録かどうか
 * @param {string} reregistrationReason - 再登録の理由（再登録時のみ）
 * @returns {string} 登録情報メッセージ
 */
function buildRegistrationInfoMessage(
  registrationJson,
  role,
  user,
  isReregistration = false,
  reregistrationReason = null
) {
  const roleLabel = role === 'driver' ? '送迎者' : '利用者';
  let message = '';

  // 基本情報
  message += '📋 登録情報\n';
  message += '基本情報\n';
  message += `・ユーザー：${user.tag}\n`;
  message += `・登録区分：${roleLabel}\n`;

  // 現在の登録情報
  if (registrationJson?.current) {
    const current = registrationJson.current;
    message += '📌 現在の登録情報\n';

    if (role === 'driver') {
      message += `・ニックネーム：${current.nickname || '未設定'}\n`;
      message += `・車種/カラー/ナンバー：${current.car || '未設定'}\n`;
      message += `・乗車人数：${current.capacity || '未設定'}人\n`;
      message += `・whooID：${current.whooId || '未設定'}\n`;
    } else {
      message += `・店舗名 / ニックネーム：${current.storeName || '未設定'}\n`;
      message += `・目印：${current.mark || '未設定'}\n`;
    }

    if (current.registeredAt) {
      const registeredAt = new Date(current.registeredAt).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      message += `\n登録日時：${registeredAt}\n`;
    }
  }

  // 過去の登録情報（履歴）
  if (registrationJson?.history && registrationJson.history.length > 0) {
    registrationJson.history.forEach((historyItem, index) => {
      message += `🕒 過去の登録情報 ${index + 1}\n`;

      if (role === 'driver') {
        message += `・ニックネーム：${historyItem.nickname || '未設定'}\n`;
        message += `・車種/カラー/ナンバー：${historyItem.car || '未設定'}\n`;
        message += `・乗車人数：${historyItem.capacity || '未設定'}人\n`;
        message += `・whooID：${historyItem.whooId || '未設定'}\n`;
      } else {
        message += `・店舗名 / ニックネーム：${historyItem.storeName || '未設定'}\n`;
        message += `・目印：${historyItem.mark || '未設定'}\n`;
      }

      if (historyItem.oldRegisteredAt && historyItem.changedAt) {
        const startDate = new Date(historyItem.oldRegisteredAt).toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const endDate = new Date(historyItem.changedAt).toLocaleString('ja-JP', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        message += `\n有効期間：${startDate} 〜 ${endDate}\n`;
      }
    });
  }

  return message;
}

/**
 * 初回登録メッセージを生成
 * @param {Object} registrationJson - 完全な登録JSON（current + history）
 * @param {string} role - 役割 ('driver' または 'user')
 * @param {Object} user - Discordユーザーオブジェクト
 * @returns {string} 初回登録メッセージ
 */
function buildInitialRegistrationMessage(registrationJson, role, user) {
  const roleLabel = role === 'driver' ? '送迎者' : '利用者';
  let message = '────────────────────\n';
  message += '📥 登録情報（初回登録）\n';
  message += '────────────────────\n';

  if (registrationJson?.current) {
    const current = registrationJson.current;

    if (role === 'driver') {
      message += `・ニックネーム：${current.nickname || '未設定'}\n`;
      message += `・車種/カラー/ナンバー：${current.car || '未設定'}\n`;
      message += `・乗車人数：${current.capacity || '未設定'}\n`;
      message += `・whooID：${current.whooId || '未設定'}\n`;
    } else {
      message += `・店舗名 / ニックネーム：${current.storeName || '未設定'}\n`;
      message += `・目印：${current.mark || '未設定'}\n`;
    }

    if (current.registeredAt) {
      const registeredAt = new Date(current.registeredAt).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      message += `\n・登録日時：${registeredAt}\n`;
    }
  }

  message += '────────────────────\n';
  return message;
}

/**
 * 再登録ログメッセージを生成
 * @param {string} role - 役割 ('driver' または 'user')
 * @param {string} reason - 再登録の理由
 * @returns {string} 再登録ログメッセージ
 */
function buildReregistrationLogMessage(role, reason = '内容更新（車種／区域／登録修正 等）') {
  const roleLabel = role === 'driver' ? '送迎者' : '利用者';
  const now = new Date().toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  let message = '────────────────────\n';
  message += '🔁 再登録ログ\n';
  message += '────────────────────\n';
  message += `・登録区分：${roleLabel}\n`;
  message += `・理由：${reason}\n`;
  message += `・再登録日時：${now}\n`;

  return message;
}

/**
 * スレッドオプション説明メッセージを生成
 * @returns {string} スレッドオプション説明メッセージ
 */
function buildThreadOptionsMessage() {
  let message = '📁 履歴メモの整理（スレッド化）について\n';
  message += 'メモ履歴が増えた場合、\n';
  message += 'このメモチャンネルを見やすく保つため\n';
  message += '履歴をスレッドにまとめることができます。\n\n';
  message += '■ 選択可能な期間\n';
  message += '・1週間\n';
  message += '・2週間\n';
  message += '・1か月\n';
  message += '・半年\n\n';
  message += '※ 選択がない場合、スレッドは作成されません\n';
  message += '※ この設定は再登録時に変更可能です\n';
  message += '設定は登録時の選択内容に基づいて自動処理されます';

  return message;
}

module.exports = {
  buildRegistrationInfoMessage,
  buildInitialRegistrationMessage,
  buildReregistrationLogMessage,
  buildThreadOptionsMessage,
};
