// src/bot/handler/送迎処理/createDispatchVC.js
const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { updateVcState } = require('../../utils/vcStateStore');
const { findUserMemoChannel } = require('../../utils/findUserMemoChannel');
const { createUserMemoChannel } = require('../../utils/createUserMemoChannel');
const { updateRideListPanel } = require('./一覧パネル更新');
const { updateDriverPanel } = require('../送迎パネル/メイン');
const { updateUserPanel } = require('../利用者パネル/メイン');

/**
 * 送迎依頼マッチング後のVC作成・通知共通処理
 * @param {Object} params
 * @param {Guild} params.guild
 * @param {User} params.requester 依頼者
 * @param {string} params.driverId 送迎者ID
 * @param {string} params.driverPlace 送迎者の待機場所
 * @param {Object} params.dispatchData 配車データ
 * @param {Object} params.config サーバー設定
 */
module.exports = async function createDispatchVC({ guild, requester, driverId, driverPlace, dispatchData, config }) {
    const userId = requester.id;
    const rideId = dispatchData.rideId;
    const isGuest = dispatchData.guest;
    const typeLabel = isGuest ? 'ゲスト送迎依頼' : '送迎依頼';
    const direction = dispatchData.direction;
    const count = dispatchData.count;
    const note = dispatchData.note || '';

    // 1. プライベートVC作成
    const parentId = config.categories?.privateVc;
    let vcChannel = null;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const matchTimeStr = `${hours}:${minutes}`;

    const driverLocation = driverPlace && driverPlace !== '不明' ? driverPlace : '待機中';
    const markInfo = dispatchData.destination || direction;
    const destInfo = direction;

    // ルート：【送迎者現在地】→【住所・目印】→【利用者方面・目的地】
    const routeInfo = `【${driverLocation}】→【${markInfo}】→【${destInfo}】`;
    dispatchData.route = routeInfo;
    dispatchData.matchTime = matchTimeStr;

    if (parentId) {
        const channelName = `${now.getMonth() + 1}/${now.getDate()} ${matchTimeStr}~--:-- ${routeInfo}`;
        try {
            vcChannel = await guild.channels.create({
                name: channelName.substring(0, 100),
                type: ChannelType.GuildVoice,
                parent: parentId,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: driverId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
                    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
                    { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
                ],
            });

            if (vcChannel) {
                dispatchData.vcId = vcChannel.id;
                dispatchData.matchTime = `${hours}:${minutes}`;

                const { buildVcControlEmbed } = require('../../utils/配車/vcControlEmbedBuilder');
                const controlEmbed = buildVcControlEmbed(dispatchData);

                const controlButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`ride|approach|rid=${rideId}`).setLabel('向かっています').setStyle(ButtonStyle.Secondary).setEmoji('🚗'),
                    new ButtonBuilder().setCustomId(`ride|start|rid=${rideId}`).setLabel('送迎開始').setStyle(ButtonStyle.Success).setEmoji('🚀'),
                    new ButtonBuilder().setCustomId(`ride|end|rid=${rideId}`).setLabel('送迎終了').setStyle(ButtonStyle.Primary).setEmoji('✅')
                );
                const ctrlMsg = await vcChannel.send({ embeds: [controlEmbed], components: [controlButtons] });
                dispatchData.vcMessageId = ctrlMsg.id;

                // 利用中一覧に登録
                const userInUsePath = paths.userInUseListJson(guild.id);
                const usersInUse = await store.readJson(userInUsePath, []).catch(() => []);
                if (!usersInUse.includes(userId)) {
                    usersInUse.push(userId);
                    await store.writeJson(userInUsePath, usersInUse);
                }
            }
        } catch (e) {
            console.error('VC作成失敗', e);
        }
    }

    // 2. 個人メモ・ログ連携
    if (vcChannel) {
        const memoCategoryId = config.categories?.userMemo;
        if (memoCategoryId) {
            try {
                const { loadUserFull } = require('../../../utils/usersStore');
                const { loadDriverFull } = require('../../../utils/driversStore');
                const { buildUserRegistrationEmbed, buildDriverRegistrationEmbed } = require('../../../utils/buildRegistrationInfoEmbed');

                // --- 利用者側の処理 ---
                let userMemoChannel = await findUserMemoChannel({ guild, userId, categoryId: memoCategoryId, role: 'user' });
                const userFull = await loadUserFull(guild.id, userId);
                if (!userMemoChannel) {
                    const registrationEmbed = buildUserRegistrationEmbed(userFull, requester);
                    const createResult = await createUserMemoChannel({ guild, user: requester, categoryId: memoCategoryId, role: 'user', registrationEmbed });
                    if (createResult) userMemoChannel = createResult.channel;
                }

                let userThreadId = null;
                if (userMemoChannel) {
                    const { getOrCreateHistoryThread } = require('../../utils/getOrCreateHistoryThread');
                    const thread = await getOrCreateHistoryThread(userMemoChannel, userFull?.threadPolicy, now);
                    if (thread) {
                        userThreadId = thread.id;
                    } else {
                        // ポリシーなし or 作成失敗時は個別スレッド
                        const st = await userMemoChannel.threads.create({
                            name: `${now.getMonth() + 1}/${now.getDate()} ${routeInfo}`.substring(0, 100),
                            autoArchiveDuration: 10080,
                            reason: '送迎チャットログ用',
                        }).catch(() => null);
                        if (st) userThreadId = st.id;
                    }
                }

                // --- 送迎者側の処理 ---
                let driverMemoChannel = await findUserMemoChannel({ guild, userId: driverId, categoryId: memoCategoryId, role: 'driver' });
                const driverFull = await loadDriverFull(guild.id, driverId);
                if (!driverMemoChannel) {
                    const driverUser = await guild.members.fetch(driverId).then(m => m.user).catch(() => null);
                    if (driverUser) {
                        const registrationEmbed = buildDriverRegistrationEmbed(driverFull, driverUser);
                        const createResult = await createUserMemoChannel({ guild, user: driverUser, categoryId: memoCategoryId, role: 'driver', registrationEmbed });
                        if (createResult) driverMemoChannel = createResult.channel;
                    }
                }

                let driverThreadId = null;
                if (driverMemoChannel) {
                    const { getOrCreateHistoryThread } = require('../../utils/getOrCreateHistoryThread');
                    const thread = await getOrCreateHistoryThread(driverMemoChannel, driverFull?.threadPolicy, now);
                    if (thread) {
                        driverThreadId = thread.id;
                    } else {
                        const st = await driverMemoChannel.threads.create({
                            name: `${now.getMonth() + 1}/${now.getDate()} ${routeInfo}`.substring(0, 100),
                            autoArchiveDuration: 10080,
                            reason: '送迎チャットログ用',
                        }).catch(() => null);
                        if (st) driverThreadId = st.id;
                    }
                }

                // VCステート保存
                await updateVcState(guild.id, vcChannel.id, {
                    userId,
                    driverId,
                    memoChannelId: userMemoChannel?.id || null, // レガシー互換用
                    logThreadId: userThreadId, // レガシー互換用
                    userMemoChannelId: userMemoChannel?.id || null,
                    userLogThreadId: userThreadId,
                    driverMemoChannelId: driverMemoChannel?.id || null,
                    driverLogThreadId: driverThreadId,
                    route: routeInfo
                });

            } catch (err) {
                console.error('メモログ設定エラー:', err);
            }
        }
    }

    const fullRouteInfo = note ? `${routeInfo}\n📌 **補足**: ${note}` : routeInfo;

    // 3. 運営者ログ (MATCHED)
    const { updateRideOperatorLog } = require('../../../utils/ログ/rideLogManager');
    await updateRideOperatorLog({
        guild,
        rideId,
        status: 'MATCHED',
        data: {
            driverId,
            userId,
            area: fullRouteInfo,
            matchedAt: dispatchData.startedAt,
        }
    }).catch(() => null);

    // 4. 保存
    const activePath = `${paths.activeDispatchDir(guild.id)}/${rideId}.json`;
    await store.writeJson(activePath, dispatchData);

    // 5. 送迎中一覧 (Active List) 登録 (v2.8.1 データ統合)
    const onDutyPath = paths.onDutyDriversJson(guild.id);
    let onDutyList = await store.readJson(onDutyPath, {}).catch(() => ({}));

    // ドライバープロフィールを読み込むためのヘルパー
    const { loadDriver } = require('../../../utils/driversStore');
    const { loadUser } = require('../../../utils/usersStore');
    const driverProfile = await loadDriver(guild.id, driverId);
    const userProfile = await loadUser(guild.id, userId);

    const onDutyEntry = {
        driverId,
        driverName: driverProfile?.nickname || driverProfile?.name || '不明',
        carInfo: driverProfile?.car || '不明',
        waitStartTime: driverProfile?.lastWaitStart || now.toISOString(),
        waitLocation: driverPlace,
        matchTime: now.toISOString(),
        passenger: {
            id: userId,
            name: userProfile?.storeName || userProfile?.name || '不明',
            location: direction,
        },
        carpool: [],
        startTime: now.toISOString(),
        vcId: vcChannel?.id || null,
        rideId: rideId // 追加
    };
    onDutyList[driverId] = onDutyEntry;
    await store.writeJson(onDutyPath, onDutyList);

    // 6. 相乗り募集開始 (ゲスト以外)
    if (!isGuest) {
        const { postCarpoolRecruitment } = require('../../../utils/配車/相乗りマネージャ');
        postCarpoolRecruitment(guild, dispatchData, guild.client).catch(() => null);
    }

    // 6. 通知
    const vcLink = vcChannel ? `[プライベートVCはこちら](https://discord.com/channels/${guild.id}/${vcChannel.id})` : 'VC作成失敗';
    const successEmbed = new EmbedBuilder()
        .setTitle(`✅ ${typeLabel}マッチング成功！`)
        .setDescription(`送迎者は <@${driverId}> です。\n\n${fullRouteInfo}\n\n**ボイスチャンネル**\n${vcLink}`)
        .setColor(0x00ff00).setTimestamp();

    // 依頼者へ通知
    try { await requester.send({ embeds: [successEmbed] }); } catch (e) { }

    // 送迎者へ通知
    try {
        const driverMember = await guild.members.fetch(driverId).catch(() => null);
        if (driverMember) {
            const dEmbed = new EmbedBuilder()
                .setTitle(`🔔 新規${typeLabel}`)
                .setDescription(`利用者は <@${userId}> です。\n\n${fullRouteInfo}\n\n${vcLink}`)
                .setColor(0xffa500).setTimestamp();
            await driverMember.send({ embeds: [dEmbed] });
        }
    } catch (e) { }

    // 7. パネル更新
    await Promise.all([
        updateRideListPanel(guild, guild.client),
        updateUserPanel(guild, guild.client),
        updateDriverPanel(guild, guild.client)
    ]).catch(() => null);

    return { vcChannel, vcLink };
};
