// handler/送迎パネル/アクション/退勤.js
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const { updateDriverPanel } = require('../メイン');

const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = async function (interaction) {
  return autoInteractionTemplate(interaction, {
    ack: ACK.REPLY, // Ephemeral reply
    async run(interaction) {
      const guildId = interaction.guildId;
      const userId = interaction.user.id;

      // プロファイルを取得して更新
      // プロファイルを取得して更新
      const { loadDriver, saveDriver } = require('../../../utils/driversStore');
      const profile = await loadDriver(guildId, userId);

      if (!profile) {
        return interaction.editReply({ content: '送迎者登録が見つかりません。先に登録してください。' });
      }

      profile.available = false;
      profile.status = 'offline';
      profile.updatedAt = new Date().toISOString();

      await saveDriver(guildId, userId, profile);

      // 待機中リストから削除（待機データを取得）
      const { removeFromQueue, getQueue } = require('../../../utils/配車/待機列マネージャ');
      const waitData = await removeFromQueue(guildId, userId);

      // 詳細ログ（運営者・管理者向け）
      const { postDetailedAttendanceLog } = require('../../../utils/ログ/詳細ログ送信');

      const logData = {
        ...profile,
        clockInTime: waitData?.timestamp,
        rideCount: waitData?.rideCount || 0
      };

      await postDetailedAttendanceLog({
        guild: interaction.guild,
        user: interaction.user,
        data: logData,
        type: 'off'
      }).catch(() => null);

      // 各パネルを更新
      const { updateUserPanel } = require('../../利用者パネル/メイン');
      const updateRideListPanel = require('../../送迎処理/一覧パネル更新');
      const { postGlobalLog } = require('../../../utils/ログ/グローバルログ');

      // 待機中の台数を再取得
      const queue = await getQueue(guildId);
      const activeCount = queue.length;

      // グローバルログ送信
      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(`現在の送迎車　${activeCount}台`)
        .setColor(0xff0000);

      await postGlobalLog({
        guild: interaction.guild,
        content: '送迎車が一台退勤しました。',
        embeds: [embed]
      }).catch(() => null);

      await Promise.all([
        updateDriverPanel(interaction.guild, interaction.client),
        updateUserPanel(interaction.guild, interaction.client),
        updateRideListPanel(interaction.guild, interaction.client),
      ]).catch(err => console.error("パネル更新失敗", err));

      // ユーザーへの通知 (Ephemeral)
      await interaction.editReply({ content: 'お疲れ様でした。退勤しました。' });
    }
  });
};
