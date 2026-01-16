const store = require('../../utils/ストレージ/ストア共通');
const updateRideListPanel = require('./一覧パネル更新');
const { updateDriverPanel } = require('../送迎パネル/メイン');
const { loadDriver } = require('../../utils/driversStore'); // New Store
const { loadConfig } = require('../../utils/設定/設定マネージャ'); // Config
const { createPrivateVc } = require('../../utils/createPrivateVc'); // VC Utility
const { updateVcState } = require('../../utils/vcStateStore'); // VC State
const { ChannelType } = require('discord.js');

const interactionTemplate = require("../共通/interactionTemplate");
const { ACK } = interactionTemplate;

module.exports = async function (interaction, targetId) {
  return interactionTemplate(interaction, {
    ack: ACK.UPDATE,
    async run(interaction) {
      // targetId は乗客のユーザーID
      const guildId = interaction.guildId;
      const driverId = interaction.user.id;
      const passengerId = targetId;

      // 各データの読み込み
      const paths = require('../../utils/ストレージ/ストレージパス');
      const driverProfile = await loadDriver(guildId, driverId);
      const userProfile = await store.readJson(paths.userProfileJson(guildId, passengerId)).catch(() => null);

      if (!driverProfile) {
        return interaction.editReply({ content: '⚠️ 送迎者データが見つかりません。' });
      }
      if (!userProfile) {
        return interaction.editReply({ content: '⚠️ 利用者データが見つかりません。' });
      }

      const rideId = `${driverId}_${Date.now()}_${guildId}`;
      // Driver Location logic: Try active location, then registered stop, then unknown
      const driverLoc = driverProfile.currentLocation || driverProfile.stop || '不明';
      const userLoc = userProfile.mark || '不明';
      const dest = userProfile.name || '不明';

      const route = `【${driverLoc}】→【${userLoc}】→【${dest}】`;

      // 待機中から削除 (通常・ゲスト両方試行)
      await store.deleteFile(`${guildId}/待機中/${passengerId}.json`).catch(() => null);
      await store.deleteFile(`${guildId}/待機中/${passengerId}_guest.json`).catch(() => null);

      // 送迎中へ保存
      const ridingData = {
        rideId,
        driverId,
        passengerId,
        route,
        timestamp: Date.now(),
        status: 'active'
      };
      await store.writeJson(`${guildId}/送迎中/${rideId}.json`, ridingData);

      // --- Private VC Creation ---
      const config = await loadConfig(guildId);
      let vcInfo = "";
      if (config.categories?.privateVc) { // Config key for Private VC Category
        const driverUser = interaction.user;
        const passengerUser = await interaction.client.users.fetch(passengerId).catch(() => null);

        if (passengerUser) {
          const vc = await createPrivateVc({
            guild: interaction.guild,
            driver: driverUser,
            user: passengerUser,
            categoryId: config.categories.privateVc,
          }).catch(err => console.error("VC作成失敗", err));

          if (vc) {
            vcInfo = `\n🔒 **プライベートVC**: ${vc.toString()}`;

            // Memo Log & State Save
            const memoTopic = `user-memo:${passengerId}`;
            const memoCh = interaction.guild.channels.cache.find(ch =>
              ch.type === ChannelType.GuildText && ch.topic === memoTopic
            );
            if (memoCh) {
              // Save State for forwarding
              await updateVcState(guildId, vc.id, {
                driverId: driverId,
                userId: passengerId,
                memoChannelId: memoCh.id,
                endedAt: null
              });

              await memoCh.send({
                content: [
                  "🚕 **マッチング成立**",
                  `送迎者：${driverUser.tag}`,
                  `利用者：${passengerUser.tag}`,
                  `VC：${vc.toString()}`,
                  `ルート：${route}`
                ].join("\n"),
              }).catch(e => console.error("メモ送信失敗", e));
            }
          }
        }
      }
      // ----------------------------

      // 相乗り募集投稿
      const carpoolNotice = require('../相乗り/通知');
      const noticeMessageId = await carpoolNotice.postCarpoolNotice({
        guild: interaction.guild,
        rideId,
        rideId,
        driverLocation: driverLoc,
        userLandmark: userLoc,
        destination: dest,
        capacity: driverProfile.capacity || 1,
        currentUsers: 1,
        departureTime: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        driverUser: interaction.user,
      });

      await interaction.followUp({ content: `ユーザー <@${targetId}> の送迎を開始しました。\nルート: ${route}\n相乗り募集も投稿しました。${vcInfo}`, flags: 64 });

      // パネル更新
      await updateRideListPanel(interaction.guild, interaction.client);
      // updateDriverPanel might fail if it relies on old logic, but keeping it for now
      await updateDriverPanel(interaction.guild, interaction.client).catch(() => { });
    }
  });
};
