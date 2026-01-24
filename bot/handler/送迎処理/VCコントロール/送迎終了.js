const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const { loadDriver } = require('../../../utils/driversStore');
const { sendRatingDM } = require('../../配車システム/評価システム');
const { updateVcState } = require('../../../utils/vcStateStore');
const { updateDispatchProgress } = require('../../配車システム/dispatchProgressUpdater');

/**
 * 送迎終了ボタンハンドラー (Professional Edition)
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const rideId = parsed?.params?.rid;
    if (!rideId) return;

    try {
      await interaction.deferUpdate();

      const guild = interaction.guild;
      const guildId = guild.id;
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // 1. 進捗更新
      const updatedData = await updateDispatchProgress({
        guild,
        rideId,
        status: 'COMPLETED',
        updates: {
          endTime: timeStr,
          completedAt: now.toISOString()
        }
      });

      if (!updatedData) {
        return interaction.followUp({ content: '⚠️ 送迎データが見つかりません。', flags: 64 });
      }

      const isDriver = interaction.user.id === updatedData.driverId;
      const isUser = interaction.user.id === updatedData.userId;
      const carpoolIndex = (updatedData.carpoolUsers || []).findIndex(u => u.userId === interaction.user.id);

      await interaction.channel.send(`※送迎終了通知：<@${interaction.user.id}> (${timeStr})`);

      // ボタンの無効化処理 (全員終了したかに関わらず、押した本人の視覚フィードバックを優先)
      const newComponents = interaction.message.components.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach(c => {
          if (c.customId === interaction.customId) {
            let label = c.label;
            if (isDriver && !label.includes('済')) label += '(送迎者済)';
            else if (isUser && !label.includes('済')) label += '(利用者済)';
            c.setLabel(label);
            c.setDisabled(true);
          }
        });
        return newRow;
      });
      await interaction.editReply({ components: newComponents });

      // --- 内部データ整理 ---
      const driverData = await loadDriver(guildId, updatedData.driverId);
      if (driverData) {
        driverData.rideCount = (driverData.rideCount || 0) + 1;
        await store.writeJson(paths.driverProfileJson(guildId, updatedData.driverId), driverData);
      }

      // 履歴保存 (簡易化)
      try {
        const y = now.getFullYear(); const m = now.getMonth() + 1; const d = now.getDate();
        const globalPath = paths.globalRideHistoryJson(guildId, y, m, d);
        const history = await store.readJson(globalPath).catch(() => []);
        history.push(updatedData);
        await store.writeJson(globalPath, history);
      } catch (e) { console.error('履歴保存失敗', e); }

      // ファイル削除
      await store.deleteFile(`${paths.activeDispatchDir(guildId)}/${rideId}.json`).catch(() => null);

      // 利用中リストから削除
      const userInUsePath = paths.userInUseListJson(guildId);
      const inUseUsers = await store.readJson(userInUsePath, []).catch(() => []);
      const updatedInUse = inUseUsers.filter(id => id !== updatedData.userId);
      await store.writeJson(userInUsePath, updatedInUse);

      // VCタイトル更新
      if (interaction.channel) {
        const updatedName = interaction.channel.name.replace(/~--:--/, `~${timeStr}`);
        await interaction.channel.setName(updatedName).catch(() => null);
      }

      // --- 送迎者へ完了DM (Professional Flow) ---
      try {
        const driverMember = await guild.members.fetch(updatedData.driverId).catch(() => null);
        if (driverMember) {
          const dmEmbed = new EmbedBuilder()
            .setTitle('✅ 送迎が完了しました！')
            .setDescription([
              `**ルート：**【${updatedData.pickup}】→【${updatedData.target}】`,
              '',
              'お疲れ様でした。次の操作を選択してください。'
            ].join('\n'))
            .setColor(0x2ecc71).setTimestamp();

          const dmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('driver|on')
              .setLabel('🔁 待機列に戻る')
              .setStyle(ButtonStyle.Success)
          );
          await driverMember.send({ embeds: [dmEmbed], components: [dmRow] });
        }
      } catch (e) { }

      // --- 利用者へ評価DM ---
      await sendRatingDM(guild, updatedData);

      // VCステート更新
      const DAY = 1000 * 60 * 60 * 24;
      await updateVcState(guildId, interaction.channel.id, {
        endedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + DAY * 7).toISOString(),
      });

    } catch (error) {
      console.error('送迎終了エラー:', error);
      await interaction.followUp({ content: '⚠️ エラーが発生しました。', flags: 64 }).catch(() => null);
    }
  }
};
