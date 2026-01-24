const store = require('../../utils/ストレージ/ストア共通');
const { updateRideListPanel } = require('./一覧パネル更新');
const { updateDriverPanel } = require('../送迎パネル/メイン');
const { loadDriver } = require('../../utils/driversStore'); // New Store
const { loadUser } = require('../../utils/usersStore'); // (Added for user name/loc)
const {
  globalRideHistoryJson,
  onDutyDriversJson,
} = require('../../utils/ストレージ/ストレージパス');
const { loadConfig } = require('../../utils/設定/設定マネージャ'); // Config
const { createPrivateVc } = require('../../utils/createPrivateVc'); // VC Utility
const { updateVcState } = require('../../utils/vcStateStore'); // VC State
const { ChannelType } = require('discord.js');

const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = async function (interaction, targetId) {
  return autoInteractionTemplate(interaction, {
    ack: ACK.UPDATE,
    async run(interaction) {
      // targetId は乗客のユーザーID
      const guildId = interaction.guildId;
      const driverId = interaction.user.id;
      const passengerId = targetId;

      // 各データの読み込み
      const paths = require('../../utils/ストレージ/ストレージパス');
      const driverProfile = await loadDriver(guildId, driverId);
      const userProfile = await loadUser(guildId, passengerId);

      if (!driverProfile) {
        return interaction.editReply({ content: '⚠️ 送迎者データが見つかりません。' });
      }
      if (!userProfile) {
        return interaction.editReply({ content: '⚠️ 利用者データが見つかりません。' });
      }

      // --- NEW: 送迎中一覧 & 送迎履歴への記録 ---
      const now = new Date();
      const matchTimeStr = now.toISOString();

      // 1. 送迎中一覧 (Active List)
      const onDutyPath = onDutyDriversJson(guildId);
      let onDutyList = await store.readJson(onDutyPath).catch(() => ({}));
      if (!onDutyList) onDutyList = {};

      const rideEntry = {
        driverId,
        driverName: driverProfile?.nickname || driverProfile?.name || '不明',
        carInfo: driverProfile?.car || '不明',
        waitStartTime: driverProfile?.lastWaitStart || matchTimeStr,
        waitLocation: '待機中',
        matchTime: matchTimeStr,
        passenger: {
          id: passengerId,
          name: userProfile?.storeName || userProfile?.name || '不明',
          location: userProfile?.address || '不明', // 方面
        },
        carpool: [],
        startTime: matchTimeStr,
        vcId: null,
      };

      onDutyList[driverId] = rideEntry;
      await store.writeJson(onDutyPath, onDutyList);

      // 2. 送迎履歴 (Global History)
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const historyPath = globalRideHistoryJson(guildId, y, m, d);

      let historyList = await store.readJson(historyPath).catch(() => ({}));
      if (!historyList) historyList = {};

      const historyId = `${now.getFullYear()}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}_${now.getHours()}${now.getMinutes()}${now.getSeconds()}_${driverId}`;

      historyList[historyId] = {
        ...rideEntry,
        historyId,
        driverId, // Explicitly keep driverId
        endTime: null, // 未完了
      };
      // -------------------------------------------

      const rideId = `${driverId}_${Date.now()}_${guildId}`;
      // Driver Location: Fallback to '待機中' as stop places are removed
      const driverLoc = driverProfile.currentLocation || '待機中';
      const userLoc = userProfile.address || '不明';
      const dest = userProfile.name || '不明';

      const route = `【${driverLoc}】→【${userLoc}】→【${dest}】`;

      // 待機中から削除 (通常・ゲスト両方試行)
      const userWaitingDir = paths.waitingUsersDir(guildId);
      await store.deleteFile(`${userWaitingDir}/${passengerId}.json`).catch(() => null);
      await store.deleteFile(`${userWaitingDir}/${passengerId}_guest.json`).catch(() => null);

      // 送迎中へ保存
      const ridingData = {
        rideId,
        driverId,
        passengerId,
        route,
        timestamp: Date.now(),
        status: 'active',
      };
      const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
      await store.writeJson(activePath, ridingData);

      // 運営者ログ (v1.3.8)
      const { updateRideOperatorLog } = require('../../utils/ログ/rideLogManager');
      await updateRideOperatorLog({
        guild: interaction.guild,
        rideId,
        status: 'MATCHED',
        data: {
          driverId,
          driverNickname: driverProfile.nickname,
          userId: passengerId,
          userName: userProfile.name,
          area: route,
        }
      }).catch(() => null);

      // --- Private VC Creation ---
      const config = await loadConfig(guildId);
      let vcInfo = '';
      if (config.categories?.privateVc) {
        // Config key for Private VC Category
        const driverUser = interaction.user;
        const passengerUser = await interaction.client.users.fetch(passengerId).catch(() => null);

        if (passengerUser) {
          const vc = await createPrivateVc({
            guild: interaction.guild,
            driver: driverUser,
            user: passengerUser,
            categoryId: config.categories.privateVc,
            rideId: rideId,
            pickupLocation: userLoc,
            destination: dest,
            userMark: userLoc,
          }).catch((err) => console.error('VC作成失敗', err));

          if (vc) {
            vcInfo = `\n🔒 **プライベートVC**: ${vc.toString()}`;

            // Memo Log & State Save
            const memoTopic = `user-memo:${passengerId}`;
            const memoCh = interaction.guild.channels.cache.find(
              (ch) => ch.type === ChannelType.GuildText && ch.topic === memoTopic
            );
            if (memoCh) {
              // Save State for forwarding
              await updateVcState(guildId, vc.id, {
                driverId: driverId,
                userId: passengerId,
                memoChannelId: memoCh.id,
                endedAt: null,
              });

              // --- VC IDを一覧に反映 ---
              if (onDutyList[driverId]) {
                onDutyList[driverId].vcId = vc.id;
                await store.writeJson(onDutyPath, onDutyList);
              }
              // -------------------------

              await memoCh
                .send({
                  content: [
                    '🚕 **マッチング成立**',
                    `送迎者：${driverUser.tag}`,
                    `利用者：${passengerUser.tag}`,
                    `VC：${vc.toString()}`,
                    `ルート：${route}`,
                  ].join('\n'),
                })
                .catch((e) => console.error('メモ送信失敗', e));
            }
          }
        }
      }
      // ----------------------------

      await interaction.followUp({
        content: `ユーザー <@${targetId}> の送迎を開始しました。\nルート: ${route}${vcInfo}`,
        flags: 64,
      });

      // パネル更新
      await updateRideListPanel(interaction.guild, interaction.client);
      // updateDriverPanel might fail if it relies on old logic, but keeping it for now
      await updateDriverPanel(interaction.guild, interaction.client).catch(() => { });
    },
  });
};
