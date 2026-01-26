/**
 * 送迎システム 共通定数定義 (Professional Edition)
 */

/**
 * 送迎状態 (Ride Status)
 */
const RideStatus = Object.freeze({
    /** 依頼中（ドライバー待ち） */
    PENDING: 'pending',
    /** マッチング成立 */
    MATCHED: 'matched',
    /** ドライバー合流地点到着・向かっています */
    APPROACHING: 'approaching',
    /** 送迎開始 */
    STARTED: 'started',
    /** 送迎完了 */
    COMPLETED: 'completed',
    /** キャンセル */
    CANCELLED: 'cancelled'
});

/**
 * 状態遷移の定義 (State Transition Rules)
 * キー: 現在の状態, 値: 遷移可能な次の状態
 */
const RideTransitions = Object.freeze({
    [RideStatus.PENDING]: [RideStatus.MATCHED, RideStatus.CANCELLED],
    [RideStatus.MATCHED]: [RideStatus.APPROACHING, RideStatus.STARTED, RideStatus.CANCELLED],
    [RideStatus.APPROACHING]: [RideStatus.STARTED, RideStatus.CANCELLED],
    [RideStatus.STARTED]: [RideStatus.COMPLETED, RideStatus.CANCELLED],
    [RideStatus.COMPLETED]: [],
    [RideStatus.CANCELLED]: []
});

/**
 * 相乗り状態 (Carpool Status)
 */
const CarpoolStatus = Object.freeze({
    /** 募集主 */
    RECRUITING: 'recruiting',
    /** 募集中 */
    MATCHED: 'matched',
    /** 完了 */
    COMPLETED: 'completed',
    /** キャンセル */
    CANCELLED: 'cancelled'
});

/**
 * ユーザー種別
 */
const UserRole = Object.freeze({
    DRIVER: 'driver',
    USER: 'user',
    OPERATOR: 'operator'
});

module.exports = {
    RideStatus,
    RideTransitions,
    CarpoolStatus,
    UserRole
};
