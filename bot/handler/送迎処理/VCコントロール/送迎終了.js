const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const { loadDriver } = require('../../../utils/driversStore');
const { sendRatingDM } = require('../../配車システム/評価システム');
const { updateVcState } = require('../../../utils/vcStateStore');

/**
 * 送迎終了ボタンハンドラー
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

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const isDriver = interaction.user.id === dispatchData.driverId;
      const isUser = interaction.user.id === dispatchData.userId;
      const carpoolIndex = (dispatchData.carpoolUsers || []).findIndex(u => u.userId === interaction.user.id);

      if (!isDriver && !isUser && carpoolIndex === -1) {
        return interaction.followUp({
          content: '⚠️ この送迎の関係者のみが操作できます。',
          flags: 64,
        });
      }

      if (isDriver) {
        if (dispatchData.driverEndTime)
          return interaction.followUp({ content: '⚠️ 既に終了済みです。', flags: 64 });
        dispatchData.driverEndTime = timeStr;
        await interaction.channel.send(`※送迎終了：送迎者 <@${interaction.user.id}> (${timeStr})`);
      } else if (isUser) {
        if (dispatchData.userEndTime)
          return interaction.followUp({ content: '⚠️ 既に終了済みです。', flags: 64 });
        dispatchData.userEndTime = timeStr;
        await interaction.channel.send(`※送迎終了：利用者 <@${interaction.user.id}> (${timeStr})`);
      } else {
        if (dispatchData.carpoolUsers[carpoolIndex].endTime)
          return interaction.followUp({ content: '⚠️ 既に終了済みです。', flags: 64 });
        dispatchData.carpoolUsers[carpoolIndex].endTime = timeStr;
        await interaction.channel.send(`※送迎終了：相乗り者${carpoolIndex + 1} <@${interaction.user.id}> (${timeStr})`);
      }

      const allCarpoolFinished = (dispatchData.carpoolUsers || []).every(u => u.endTime);
      const isFinished = dispatchData.driverEndTime && dispatchData.userEndTime && allCarpoolFinished;

      if (isFinished) {
        dispatchData.completedAt = now.toISOString();
        dispatchData.status = 'completed';
      }
      await store.writeJson(activePath, dispatchData);

      const { buildVcControlEmbed } = require('../../../utils/配車/vcControlEmbedBuilder');
      const newEmbed = buildVcControlEmbed(dispatchData);

      const currentComponents = interaction.message.components;
      let newComponents = currentComponents.map((row) => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach((component) => {
          if (component.customId === interaction.customId) {
            let label = component.label;
            if (isDriver && !label.includes('送迎者済')) label += '(送迎者済)';
            if (isUser && !label.includes('利用者済')) label += '(利用者済)';
            if (carpoolIndex >= 0 && !label.includes(`相乗り${carpoolIndex + 1}済`)) {
              label += `(相乗り${carpoolIndex + 1}済)`;
            }
            component.setLabel(label);

            if (isFinished) {
              component.setDisabled(true);
              component.setStyle(ButtonStyle.Secondary);
            }
          }
        });
        return newRow;
      });

      if (isFinished) {
        newComponents = newComponents.map((row) => {
          const newRow = ActionRowBuilder.from(row);
          newRow.components.forEach((component) => {
            component.setDisabled(true);
            component.setStyle(ButtonStyle.Secondary);
          });
          return newRow;
        });
      }

      await interaction.editReply({ embeds: [newEmbed], components: newComponents });

      if (!isFinished) return;

      const driverData = await loadDriver(guildId, dispatchData.driverId);
      if (driverData) {
        driverData.rideCount = (driverData.rideCount || 0) + 1;
        const driverPath = paths.driverProfileJson(guildId, dispatchData.driverId);
        await store.writeJson(driverPath, driverData);
      }

      await store.deleteFile(activePath).catch(() => null);

      try {
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const d = now.getDate();

        const globalPath = paths.globalRideHistoryJson(guildId, y, m, d);
        const globalHistory = await store.readJson(globalPath).catch(() => []);
        globalHistory.push(dispatchData);
        await store.writeJson(globalPath, globalHistory);

        const driverHistoryPath = paths.driverRideHistoryJson(guildId, dispatchData.driverId, y, m, d);
        const driverHistory = await store.readJson(driverHistoryPath).catch(() => []);
        driverHistory.push(dispatchData);
        await store.writeJson(driverHistoryPath, driverHistory);

        const userHistoryPath = paths.userRideHistoryJson(guildId, dispatchData.userId, y, m, d);
        const userHistory = await store.readJson(userHistoryPath).catch(() => []);
        userHistory.push(dispatchData);
        await store.writeJson(userHistoryPath, userHistory);
      } catch (err) {
        console.error('送迎履歴保存エラー:', err);
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
        console.error('利用中一覧更新エラー:', err);
      }

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

      if (interaction.channel) {
        const currentName = interaction.channel.name;
        const updatedName = currentName.replace(/~--:--/, `~${timeStr}`);
        await interaction.channel.setName(updatedName).catch(() => null);
      }

      const { updateRideOperatorLog } = require('../../../utils/ログ/rideLogManager');
      await updateRideOperatorLog({
        guild: interaction.guild,
        rideId: rideId,
        status: 'ENDED',
        data: {
          driverId: dispatchData.driverId,
          userId: dispatchData.userId,
          area: dispatchData.direction || dispatchData.route || dispatchData.area,
          count: dispatchData.count,
          endedAt: now.toISOString(),
        }
      }).catch(() => null);

      const completionEmbed = new EmbedBuilder()
        .setTitle('送迎終了しました')
        .setDescription(
          '落とし物などのトラブルが無ければ、\n1週間でこのvcチャンネルは削除されます。\n\n' +
          '※トラブルがあった場合は、削除延長を押して下さい。'
        )
        .setColor(0x000000); // 終了時は黒

      const completionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ride|control|sub=extend&rid=${rideId}`)
          .setLabel('削除延長')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.channel.send({ embeds: [completionEmbed], components: [completionRow] });

      const DAY = 1000 * 60 * 60 * 24;
      const expiresAt = new Date(now.getTime() + DAY * 7);

      await updateVcState(guildId, interaction.channel.id, {
        endedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });

      await sendRatingDM(guild, dispatchData);
    } catch (error) {
      console.error('送迎終了エラー:', error);
      await interaction
        .followUp({ content: '⚠️ エラーが発生しました。', flags: 64 })
        .catch(() => null);
    }
  }
};
