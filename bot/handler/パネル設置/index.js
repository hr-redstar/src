// src/bot/handler/パネル設置/index.js
/**
 * handler 側でまとめて読み込めるようにするエントリ
 * - メイン はコマンドから直接呼ぶ
 * - handlers は interactionCreate のボタンルーティングで使う想定
 */

const sendPanelSetupPanel = require('./メイン');

const adminpanl = require('./アクション/管理者パネル表示');
const adminpanl_selectChannel = require('./アクション/管理者パネル送信先選択');
const driverpanel = require('./アクション/送迎者パネル表示');
const driverpanel_select = require('./アクション/送迎者パネル送信先選択');
const userpanel = require('./アクション/利用者パネル表示');
const userpanel_select = require('./アクション/利用者パネル送信先選択');

const driverregpanel = require('./アクション/送迎者登録パネル表示');
const driverregpanel_select = require('./アクション/送迎者登録パネル送信先選択');
const userregpanel = require('./アクション/利用者登録パネル表示');
const userregpanel_select = require('./アクション/利用者登録パネル送信先選択');

const usercheckpanel = require('./アクション/ユーザー確認パネル表示');
const usercheckpanel_select = require('./アクション/ユーザー確認パネル送信先選択');
const ridelistpanel = require('./アクション/送迎一覧パネル表示');
const ridelistpanel_select = require('./アクション/送迎一覧パネル送信先選択');
const guidepanel = require('./アクション/案内パネル表示');
const guidepanel_initial = require('./アクション/案内パネル初期入力');
const guidepanel_select = require('./アクション/案内パネル送信先選択');

const statusCheck = require('./アクション/状態確認');

const ratingrankpanel = require('./アクション/口コミランクパネル表示');
const ratingrankpanel_select = require('./アクション/口コミランクパネル送信先選択');
const carpoolpanel = require('./アクション/相乗りパネル表示');
const carpoolpanel_select = require('./アクション/相乗りパネル送信先選択');

const globallogpanel = require('./アクション/グローバルログパネル表示');
const globallogpanel_select = require('./アクション/グローバルログパネル送信先選択');
const stafflogpanel = require('./アクション/運営者ログパネル表示');
const stafflogpanel_select = require('./アクション/運営者ログパネル送信先選択');
const flow = require('./アクション/パネル設置フロー');

module.exports = {
  sendPanelSetupPanel,
  handlers: [
    adminpanl,
    adminpanl_selectChannel,
    driverpanel,
    driverpanel_select,
    userpanel,
    userpanel_select,
    driverregpanel,
    driverregpanel_select,
    userregpanel,
    userregpanel_select,
    usercheckpanel,
    usercheckpanel_select,
    ridelistpanel,
    ridelistpanel_select,
    guidepanel,
    guidepanel_initial,
    guidepanel_select,
    statusCheck,
    ratingrankpanel,
    ratingrankpanel_select,
    carpoolpanel,
    carpoolpanel_select,
    globallogpanel,
    globallogpanel_select,
    stafflogpanel,
    stafflogpanel,
    stafflogpanel_select,
    // Refined Flow
    flow.startHandler,
    flow.typeHandler
  ],
};
