// src/bot/handler/送迎処理/createDispatchVC.js
const { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { updateVcState } = require('../../utils/vcStateStore');
const { findUserMemoChannel } = require('../../utils/findUserMemoChannel');
const { createUserMemoChannel } = require('../../utils/createUserMemoChannel');
const { updateRideListPanel } = require('./一覧パネル更新');
const { updateDriverPanel } = require('../送迎パネル/メイン');
const { updateUserPanel } = require('../利用者パネル/メイン');
const { buildDispatchEmbed } = require('../../utils/配車/dispatchEmbedBuilder');
const { updateRideOperatorLog } = require('../../utils/ログ/rideLogManager');
const { loadDriver } = require('../../utils/driversStore');
const { loadUser } = require('../../utils/usersStore');

/**
 * 送迎依頼マッチング後のVC作成・通知共通処理 (High-Performance Edition v2.9.0)
 */
module.exports = async function createDispatchVC({ guild, requester, driverId, driverPlace, dispatchData, config }) {
    const userId = requester.id;
    const rideId = dispatchData.rideId;
    const isGuest = dispatchData.guest;
    const direction = dispatchData.direction; // 目的地方面
    const now = new Date();

    // ユーザー情報の取得 (pickup地点取得のため)
    const userProfile = await loadUser(guild.id, userId);
    const pickup = userProfile?.mark || userProfile?.landmark || userProfile?.address || '不明'; // 利用者の「方面」

    // 時刻・日付フォーマット
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;

    dispatchData.pickup = pickup;
    dispatchData.target = direction;
    dispatchData.date = dateStr;
    dispatchData.matchTime = timeStr;
    dispatchData.status = 'MATCHED';

    // 1. プライベートVC作成
    const parentId = config.categories?.privateVc;
    let vcChannel = null;

    // VCタイトル: MM/DD HH:mm~--:-- 【方面】→【方角】
    const standardizedTitle = `${dateStr} ${timeStr}~--:-- 【${pickup}】→【${direction}】`;

    if (parentId) {
        try {
            vcChannel = await guild.channels.create({
                name: standardizedTitle.substring(0, 100),
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

                // Embed生成
                const controlEmbed = buildDispatchEmbed(dispatchData);

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
    } else {
        console.warn(`[createDispatchVC] VCカテゴリ(privateVc)が未設定のためVC作成をスキップします。Guild: ${guild.id}`);
    }

    // 2. 運営者ログ (MATCHED) - 同一Embed更新方式
    await updateRideOperatorLog({
        guild,
        rideId,
        status: 'MATCHED',
        data: dispatchData
    }).catch(() => null);

    // 3. 利用者メモ・スレッド連携
    if (vcChannel) {
        const memoCategoryId = config.categories?.userMemo;
        if (memoCategoryId) {
            try {
                let userMemoChannel = await findUserMemoChannel({ guild, userId, categoryId: memoCategoryId, role: 'user' });
                if (!userMemoChannel) {
                    const { buildUserRegistrationEmbed } = require('../../utils/buildRegistrationInfoEmbed');
                    const userFull = await loadUser(guild.id, userId); // Full load if needed
                    const registrationEmbed = buildUserRegistrationEmbed(userFull, requester);
                    const createResult = await createUserMemoChannel({ guild, user: requester, categoryId: memoCategoryId, role: 'user', registrationEmbed });
                    if (createResult) userMemoChannel = createResult.channel;
                }

                if (userMemoChannel) {
                    dispatchData.userMemoChannelId = userMemoChannel.id;

                    // スレッドポリシーの取得とスレッド特定 (v2.9.1)
                    const { loadUserFull } = require('../../utils/usersStore');
                    const { getOrCreateHistoryThread } = require('../../utils/getOrCreateHistoryThread');
                    const userFull = await loadUserFull(guild.id, userId).catch(() => null);
                    const threadPolicy = userFull?.threadPolicy || { enabled: true, period: '1w' }; // デフォルト週次

                    const thread = await getOrCreateHistoryThread(userMemoChannel, threadPolicy, now);
                    const target = thread || userMemoChannel;

                    if (thread) {
                        dispatchData.userLogThreadId = thread.id;
                    }

                    const controlEmbed = buildDispatchEmbed(dispatchData);
                    const memoMsg = await target.send({ embeds: [controlEmbed] });
                    dispatchData.userMemoMessageId = memoMsg.id;

                    // VCステート保存 (後で進捗更新時にスレッドも更新できるように)
                    await updateVcState(guild.id, vcChannel.id, {
                        userId,
                        driverId,
                        userMemoChannelId: userMemoChannel.id,
                        userLogThreadId: thread?.id || null,
                        userMemoMessageId: memoMsg.id,
                        route: standardizedTitle,
                        pickup,
                        target: direction
                    });
                }
            } catch (err) {
                console.error('利用者メモ連携エラー:', err);
            }
        }
    }

    // 4. 保存
    const activePath = `${paths.activeDispatchDir(guild.id)}/${rideId}.json`;
    await store.writeJson(activePath, dispatchData);

    // 5. 送迎中一覧 (Active List) 登録
    const onDutyPath = paths.onDutyDriversJson(guild.id);
    let onDutyList = await store.readJson(onDutyPath, {}).catch(() => ({}));
    const driverProfile = await loadDriver(guild.id, driverId);

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
        rideId: rideId
    };
    onDutyList[driverId] = onDutyEntry;
    await store.writeJson(onDutyPath, onDutyList);

    // 6. 相乗り募集開始 (ゲスト以外)
    if (!isGuest) {
        const { postCarpoolRecruitment } = require('../../utils/配車/相乗りマネージャ');
        postCarpoolRecruitment(guild, dispatchData, guild.client).catch(() => null);
    }

    // 7. 個人DM通知
    const vcLink = vcChannel ? `[プライベートVCはこちら](https://discord.com/channels/${guild.id}/${vcChannel.id})` : 'VC作成失敗';

    // 利用者DM
    try {
        const { EmbedBuilder } = require('discord.js');
        const driverMember = await guild.members.fetch(driverId).catch(() => null);
        const uEmbed = new EmbedBuilder()
            .setTitle('✅ マッチングしました！')
            .setDescription([
                `送迎者は **${driverMember?.displayName || '送迎者'}** です。`,
                '',
                `【${pickup}】→【${direction}】`,
                '',
                '🔊 **ボイスチャンネル**',
                vcLink
            ].join('\n'))
            .setColor(0x00ff00).setTimestamp();
        await requester.send({ embeds: [uEmbed] });
    } catch (e) {
        console.warn(`[createDispatchVC] 利用者へのDM送信失敗: ${e.message}`);
    }

    // 送迎者DM
    try {
        const driverMember = await guild.members.fetch(driverId).catch(() => null);
        if (driverMember) {
            const { EmbedBuilder } = require('discord.js');
            const dEmbed = new EmbedBuilder()
                .setTitle('🚗 新しい依頼が入りました！')
                .setDescription([
                    `利用者は **${requester.globalName || requester.username}** です。`,
                    '',
                    `【${pickup}】→【口頭で伝える】`,
                    '',
                    '🔊 **ボイスチャンネル**',
                    vcLink
                ].join('\n'))
                .setColor(0xffa500).setTimestamp();
            await driverMember.send({ embeds: [dEmbed] });
        }
    } catch (e) {
        console.warn(`[createDispatchVC] 送迎者へのDM送信失敗: ${e.message}`);
    }

    // 8. パネル更新
    await Promise.all([
        updateRideListPanel(guild, guild.client),
        updateUserPanel(guild, guild.client),
        updateDriverPanel(guild, guild.client)
    ]).catch(() => null);

    return { vcChannel, vcLink };
};
