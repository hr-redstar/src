// src/bot/handler/パネル設置/index.js
// v1.6.4 (Scalable & Safe Registry)

const sendPanelSetupPanel = require('./メイン');
const sendOperatorPanel = require('../運営者パネル/メイン');
const operatorDirectionsListRegister = require('../運営者パネル/方面リスト登録');
const operatorDirectionsListRegisterComplete = require('../運営者パネル/方面リスト登録完了');
const operatorDirectionsDetailRegister = require('../運営者パネル/方面リスト詳細登録');
const operatorDirectionsDetailInput = require('../運営者パネル/方面リスト詳細入力');
const operatorDirectionsDetailComplete = require('../運営者パネル/方面リスト詳細完了');
const operatorCreditsRegister = require('../運営者パネル/ユーザークレジット登録');
const operatorCreditsComplete = require('../運営者パネル/ユーザークレジット登録完了');

// --- アクションハンドラーの読み込み ---
const adminPanel = require('./アクション/管理者パネル表示');
const adminPanelSelect = require('./アクション/管理者パネル送信先選択');
const driverPanel = require('./アクション/送迎者パネル表示');
const driverPanelSelect = require('./アクション/送迎者パネル送信先選択');
const userPanel = require('./アクション/利用者パネル表示');
const userPanelSelect = require('./アクション/利用者パネル送信先選択');

const driverRegPanel = require('./アクション/送迎者登録パネル表示');
const driverRegPanelSelect = require('./アクション/送迎者登録パネル送信先選択');
const userRegPanel = require('./アクション/利用者登録パネル表示');
const userRegPanelSelect = require('./アクション/利用者登録パネル送信先選択');

const userCheckPanel = require('./アクション/ユーザー確認パネル表示');
const userCheckPanelSelect = require('./アクション/ユーザー確認パネル送信先選択');
const rideListPanel = require('./アクション/送迎一覧パネル表示');
const rideListPanelSelect = require('./アクション/送迎一覧パネル送信先選択');

const guidePanel = require('./アクション/案内パネル表示');
const guidePanelInitial = require('./アクション/案内パネル初期入力');
const guidePanelSelect = require('./アクション/案内パネル送信先選択');

const ratingRankPanel = require('./アクション/口コミランクパネル表示');
const ratingRankPanelSelect = require('./アクション/口コミランクパネル送信先選択');
const carpoolPanel = require('./アクション/相乗りパネル表示');
const carpoolPanelSelect = require('./アクション/相乗りパネル送信先選択');

const globalLogPanel = require('./アクション/運営者ログパネル表示');
const globalLogPanelSelect = require('./アクション/運営者ログパネル送信先選択');
const staffLogPanel = require('./アクション/運営者ログパネル表示');
const staffLogPanelSelect = require('./アクション/運営者ログパネル送信先選択');
const directionsPanel = require('./アクション/方面リストパネル表示');
const directionsPanelSelect = require('./アクション/方面リストパネル送信先選択');

const operatorPanelDisplay = require('./アクション/運営者パネル表示');
const operatorPanelSelect = require('./アクション/運営者パネル送信先選択');

const statusCheck = require('./アクション/状態確認');

// --- カテゴリ別ハンドラー群 (将来の拡張用) ---
const adminHandlers = [
  adminPanel,
  adminPanelSelect,
  globalLogPanel,
  globalLogPanelSelect,
  staffLogPanel,
  staffLogPanelSelect,
  directionsPanel,
  directionsPanelSelect,
];

const operationHandlers = [
  driverPanel,
  driverPanelSelect,
  userPanel,
  userPanelSelect,
  rideListPanel,
  rideListPanelSelect,
  carpoolPanel,
  carpoolPanelSelect,
];

const regHandlers = [
  driverRegPanel,
  driverRegPanelSelect,
  userRegPanel,
  userRegPanelSelect,
];

const utilityHandlers = [
  userCheckPanel,
  userCheckPanelSelect,
  guidePanel,
  guidePanelInitial,
  guidePanelSelect,
  ratingRankPanel,
  ratingRankPanelSelect,
  statusCheck,
];

const operatorHandlers = [
  sendOperatorPanel,
  operatorPanelDisplay,
  operatorPanelSelect,
  operatorDirectionsListRegister,
  operatorDirectionsListRegisterComplete,
  operatorDirectionsDetailRegister,
  operatorDirectionsDetailInput,
  operatorDirectionsDetailComplete,
  operatorCreditsRegister,
  operatorCreditsComplete,
];

module.exports = {
  sendPanelSetupPanel,
  // 意図しない改変を防止するため freeze
  handlers: Object.freeze([
    ...adminHandlers,
    ...operationHandlers,
    ...regHandlers,
    ...utilityHandlers,
    ...operatorHandlers,
  ]),
};
