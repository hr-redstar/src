const { ActionRowBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { updateDispatchProgress } = require('../../配車システム/dispatchProgressUpdater');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');

/**
 * 送迎開始ボタンハンドラー (v2.9.0)
 * ・送迎者のみ実行可能
 * ・ステータスを in_service に変更
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const rideId = parsed?.params?.rid;
    if (!rideId) return;

    try {
      // 1. データ取得
      const guildId = interaction.guildId;
      const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
      const dispatchData = await store.readJson(activePath).catch(() => null);

      if (!dispatchData) {
        return interaction.reply({ content: '⚠️ 送迎データが見つかりません。', flags: 64 });
      }

      // 2. 権限ガード (送迎者のみ)
      if (interaction.user.id !== dispatchData.driverId) {
        return interaction.reply({
          content: '❌ この操作は送迎担当者のみ実行できます。',
          flags: 64
        });
      }

      // 3. ステータスガード (二重送信防止)
      if (dispatchData.status === 'riding' || dispatchData.status === 'in_service') {
        return interaction.reply({
          content: '⚠️ 既に送迎を開始しています。',
          flags: 64
        });
      }

      if (dispatchData.status === 'finished') {
        return interaction.reply({
          content: '⚠️ 送迎は既に終了しています。',
          flags: 64
        });
      }

      // 3. 処理開始 (Defer)
      await interaction.deferUpdate();

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // 4. データ更新 & ステータス変更
      // dispatchProgressUpdater が OperatorLog の更新などを担当
      await updateDispatchProgress({
        guild: interaction.guild,
        rideId,
        status: 'STARTED', // v2.9.2 standardized status
        updates: {
          startTime: timeStr,
          rideStartedAt: now.toISOString()
        }
      });

      // 5. VC内の表示更新
      // "送迎開始" ボタンを無効化 or 表示変更
      // v2.9.0 では "送迎者: ✅ 表示, 利用者: ❌ 非表示" とあるが、
      // 既存のメッセージ上のボタンを特定のユーザーだけに隠すことはできないため、
      // ここでは実行済みであることを示してボタンを無効化する。

      const newComponents = interaction.message.components.map((row) => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach((component) => {
          if (component.customId === interaction.customId) {
            component.setLabel('送迎中').setDisabled(true).setStyle(ButtonStyle.Success);
          }
        });
        return newRow;
      });

      await interaction.editReply({ components: newComponents });

      // チャンネル通知 (本人にのみ ephemeral)
      await interaction.followUp({
        content: `※送迎開始：<@${interaction.user.id}> (${timeStr})`,
        flags: 64
      });

    } catch (error) {
      console.error('送迎開始エラー:', error);
      await interaction.followUp({ content: '⚠️ エラーが発生しました。', flags: 64 }).catch(() => null);
    }
  }
};
