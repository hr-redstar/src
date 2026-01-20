/**
 * パネル操作のルーティング定義
 * namespace に基づいて適切なハンドラーモジュールを解決する
 */

let adminMain, driverMain, userMain, driverReg, userReg, vcOps, guideMain;

const ROUTES = {
    adm: () => adminMain || (adminMain = require('./管理者パネル/メイン')),
    admin: () => adminMain || (adminMain = require('./管理者パネル/メイン')),
    ps: (parsed) => {
        if (parsed.action === 'setup' || parsed.action === 'send') {
            return require('./パネル設置/アクション/パネル設置フロー');
        }
        if (parsed.action === 'select') {
            const panelParam = parsed.params?.panel;
            // guide:base64 などの形式に対応するため、コロンで分割して先頭を取得
            const panel = panelParam ? panelParam.split(':')[0] : null;
            const map = {
                admin: './パネル設置/アクション/管理者パネル送信先選択',
                driver: './パネル設置/アクション/送迎者パネル送信先選択',
                user: './パネル設置/アクション/利用者パネル送信先選択',
                driverRegister: './パネル設置/アクション/送迎者登録パネル送信先選択',
                userRegister: './パネル設置/アクション/利用者登録パネル送信先選択',
                userCheck: './パネル設置/アクション/ユーザー確認パネル送信先選択',
                rideList: './パネル設置/アクション/送迎一覧パネル送信先選択',
                guide: './パネル設置/アクション/案内パネル送信先選択',
                ratingRank: './パネル設置/アクション/口コミランクパネル送信先選択',
                carpool: './パネル設置/アクション/相乗りパネル送信先選択',
                globalLog: './パネル設置/アクション/グローバルログパネル送信先選択',
                operatorLog: './パネル設置/アクション/運営者ログパネル送信先選択',
            };
            const path = map[panel];
            if (path) return require(path);
        }
        if (parsed.action === 'modal') {
            const sub = parsed.params?.sub;
            if (sub === 'guideInitial') return require('./パネル設置/アクション/案内パネル初期入力');
            if (sub === 'guideContent') return require('./パネル設置/アクション/案内パネル内容確定');
        }
        if (parsed.action === 'check') {
            return require('./パネル設置/アクション/状態確認');
        }
        return null;
    },
    driver: () => driverMain || (driverMain = require('./送迎パネル/メイン')),
    user: () => userMain || (userMain = require('./利用者パネル/メイン')),
    reg: (parsed) => {
        if (parsed.action === 'driver') return driverReg || (driverReg = require('./登録処理/送迎者登録'));
        if (parsed.action === 'user') return userReg || (userReg = require('./登録処理/利用者登録'));
        return null;
    },
    ride: () => vcOps || (vcOps = require('./送迎処理/VCコントロール/VC操作')),
    carpool: (parsed) => {
        const action = parsed.action;
        if (action === 'join') {
            return parsed.params?.sub === 'modal'
                ? require('./相乗り/相乗り希望モーダル')
                : require('./相乗り/相乗り希望');
        }
        if (action === 'approve') return require('./相乗り/承認');
        if (action === 'reject') {
            return parsed.params?.sub === 'modal'
                ? require('./相乗り/却下モーダル')
                : require('./相乗り/却下理由選択');
        }
        if (action === 'reject_reason') return require('./相乗り/却下理由処理');
        if (action === 'cancel') return require('./相乗り/相乗りキャンセル');
        return null;
    },
    dispatch: (parsed) => {
        if (parsed.action === 'rating') {
            const ratingSys = require('./配車システム/評価システム');
            return {
                execute: parsed.params?.sub === 'modal' ? ratingSys.handleModalSubmit : ratingSys.execute,
            };
        }
        if (parsed.action === 'forceOff') {
            return require('./送迎処理/強制退勤');
        }
        return require('./配車システム/配車依頼フロー');
    },
    memo: (parsed) => {
        if (parsed.action === 'threadpolicy') return require('./メモ管理/スレッドポリシー設定');
        if (parsed.action === 'thread') return require('./メモ管理/スレッド作成');
        return null;
    },
    guide: () => guideMain || (guideMain = require('./ガイド/メイン')),
};

/**
 * 解析済みIDからハンドラーモジュールを解決して返す
 * @param {Object} parsed - parseCustomId の結果
 * @returns {Object|null} ハンドラーモジュール
 */
function resolvePanelHandler(parsed) {
    if (!parsed || !parsed.namespace) return null;

    const resolver = ROUTES[parsed.namespace];
    if (!resolver) return null;

    return resolver(parsed);
}

module.exports = { resolvePanelHandler };
