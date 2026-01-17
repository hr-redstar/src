const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * 「向かっています」ボタンハンドラー
 * 送迎者のみ実行可能
 */
module.exports = async function handleRideEnroute(interaction, rideId) {
  try {
    await interaction.deferUpdate();

    const guild = interaction.guild;
    const guildId = guild.id;

    // Active Dispatch データを読み込み
    const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
    const dispatchData = await store.readJson(activePath).catch(() => null);

    if (!dispatchData) {
      return interaction.followUp({ content: '⚠️ 送迎データが見つかりません。', ephemeral: true });
    }

    // 送迎者（ドライバー）のみ実行可能
    if (interaction.user.id !== dispatchData.driverId) {
      return interaction.followUp({ content: '⚠️ 送迎者のみが実行できます。', ephemeral: true });
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // データ更新
    if (dispatchData.approachTime)
      return interaction.followUp({ content: '⚠️ 既に通知済みです。', ephemeral: true });
    dispatchData.approachTime = timeStr;

    // 運営者ログの同期 (更新: 青)
    const { syncOperationLog } = require('../../../utils/ログ/operationLogHelper');
    const opLogId = await syncOperationLog(guild, dispatchData);
    if (opLogId) {
      dispatchData.operationLogMessageId = opLogId;
    }

    await store.writeJson(activePath, dispatchData);

    // 通知メッセージを送信
    await interaction.channel.send({
      content: `※向かっています：<@${interaction.user.id}> (${timeStr})`,
    });

    // Embed更新
    const { buildVcControlEmbed } = require('../../utils/配車/vcControlEmbedBuilder');
    const newEmbed = buildVcControlEmbed(dispatchData);

    // ボタン更新 (向かっていますボタンのみ無効化)
    const currentComponents = interaction.message.components;
    const newComponents = currentComponents.map((row) => {
      const newRow = ActionRowBuilder.from(row);
      newRow.components.forEach((component) => {
        if (component.customId === interaction.customId) {
          component.setDisabled(true);
        }
      });
      return newRow;
    });

    await interaction.editReply({ embeds: [newEmbed], components: newComponents });
  } catch (error) {
    console.error('向かっていますエラー:', error);
    await interaction
      .followUp({ content: '⚠️ エラーが発生しました。', ephemeral: true })
      .catch(() => null);
  }
};
