const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');

/**
 * 送迎キャンセルボタンハンドラー
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const rideId = parsed?.params?.rid;
    if (!rideId) return;

    try {
      await interaction.deferUpdate();

      const guild = interaction.guild;
      const guildId = guild.id;

      const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
      const dispatchData = await store.readJson(activePath).catch(() => null);

      if (!dispatchData) {
        return interaction.followUp({ content: '⚠️ 送迎データが見つかりません。', flags: 64 });
      }

      if (interaction.user.id !== dispatchData.driverId) {
        return interaction.followUp({
          content: '⚠️ 送迎者のみがキャンセルできます。',
          flags: 64,
        });
      }

      await store.deleteFile(activePath).catch(() => null);

      if (dispatchData.carpoolMessageId) {
        const { loadConfig } = require('../../../utils/設定/設定マネージャ');
        const config = await loadConfig(guildId);
        const carpoolChId = config.rideShareChannel;
        if (carpoolChId) {
          const carpoolChannel = guild.channels.cache.get(carpoolChId);
          if (carpoolChannel) {
            await carpoolChannel.messages.delete(dispatchData.carpoolMessageId).catch(() => null);
          }
        }
      }

      if (dispatchData.vcId) {
        const vcChannel = guild.channels.cache.get(dispatchData.vcId);
        if (vcChannel) {
          await vcChannel.delete('送迎キャンセル').catch(() => null);
        }
      }

      try {
        const userInUsePath = paths.userInUseListJson(guildId);
        const usersInUse = await store.readJson(userInUsePath, []).catch(() => []);

        const idsToRemove = [dispatchData.userId];
        if (dispatchData.carpoolUsers) {
          dispatchData.carpoolUsers.forEach((u) => idsToRemove.push(u.userId));
        }

        const updatedUsers = usersInUse.filter((id) => !idsToRemove.includes(id));
        await store.writeJson(userInUsePath, updatedUsers);
      } catch (err) {
        console.error('利用中一覧更新エラー (キャンセル時):', err);
      }

      const { updateRideOperatorLog } = require('../../../utils/ログ/rideLogManager');
      await updateRideOperatorLog({
        guild: interaction.guild,
        rideId: rideId,
        status: 'CANCELLED',
        data: {
          driverId: dispatchData.driverId,
          userId: dispatchData.userId,
          area: dispatchData.direction || dispatchData.route || dispatchData.area,
          count: dispatchData.count,
          forcedEndTime: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
          endedAt: new Date().toISOString(),
        }
      }).catch(() => null);

      try {
        const userMember = await guild.members.fetch(dispatchData.userId).catch(() => null);
        if (userMember) {
          await userMember.send({
            content: `⚠️ 送迎がキャンセルされました。\n送迎者: <@${dispatchData.driverId}>`,
          });
        }
      } catch (e) {
        console.log('利用者へのキャンセル通知失敗', e);
      }

      // --- 待機列へ自動復帰 (v2.9.0) ---
      try {
        const { loadDriver } = require('../../../utils/driversStore');
        const { addToQueue } = require('../../../utils/配車/待機列マネージャ');
        const { updateRelevantPanels } = require('../../送迎パネル/メイン');

        const driverData = await loadDriver(guildId, dispatchData.driverId);
        if (driverData) {
          const actualData = driverData.current || driverData;
          const queueData = {
            userId: dispatchData.driverId,
            carInfo: actualData.car || actualData.carInfo || '不明',
            capacity: actualData.capacity || '不明',
            stopPlace: actualData.stopPlace || '不明',
            timestamp: new Date().toISOString(),
          };
          await addToQueue(guildId, queueData);

          // パネル更新
          await updateRelevantPanels(guild, client).catch(() => null);
        }
      } catch (e) {
        console.error('キャンセル時の待機復帰エラー:', e);
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      await interaction.followUp({
        content: `※送迎キャンセル：<@${interaction.user.id}> (${timeStr})`,
        flags: 64
      });
    } catch (error) {
      console.error('送迎キャンセルエラー:', error);
      await interaction
        .followUp({ content: '⚠️ エラーが発生しました。', flags: 64 })
        .catch(() => null);
    }
  }
};
