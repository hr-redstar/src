const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 送迎開始ボタンハンドラー
 * VCコントロールパネルの「送迎開始」ボタンから呼び出される
 */
module.exports = async function handleRideStart(interaction, rideId) {
  try {
    await interaction.deferUpdate();

    const guild = interaction.guild;
    const guildId = guild.id;

    // Active Dispatch データを読み込み
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

    // 時刻を記録
    if (isDriver) {
      if (dispatchData.driverStartTime)
        return interaction.followUp({ content: '⚠️ 既に開始済みです。', flags: 64 });
      dispatchData.driverStartTime = timeStr;
      await interaction.channel.send(`※送迎開始：送迎者 <@${interaction.user.id}> (${timeStr})`);
    } else if (isUser) {
      if (dispatchData.userStartTime)
        return interaction.followUp({ content: '⚠️ 既に開始済みです。', flags: 64 });
      dispatchData.userStartTime = timeStr;
      await interaction.channel.send(`※送迎開始：利用者 <@${interaction.user.id}> (${timeStr})`);
    } else {
      // 相乗り者
      if (dispatchData.carpoolUsers[carpoolIndex].startTime)
        return interaction.followUp({ content: '⚠️ 既に開始済みです。', flags: 64 });
      dispatchData.carpoolUsers[carpoolIndex].startTime = timeStr;
      await interaction.channel.send(`※送迎開始：相乗り者${carpoolIndex + 1} <@${interaction.user.id}> (${timeStr})`);
    }

    // 最初の開始時刻を rideStartedAt に保存
    if (!dispatchData.rideStartedAt) {
      dispatchData.rideStartedAt = now.toISOString();
      dispatchData.status = 'in-progress';
    }

    // 運営者ログの同期 (v1.7.0: STARTED)
    const { updateRideOperatorLog } = require('../../../utils/ログ/rideLogManager');
    await updateRideOperatorLog({
      guild: interaction.guild,
      rideId: rideId,
      status: 'STARTED',
      data: {
        startedAt: now.toISOString(),
      },
    }).catch(() => null);

    // データを保存
    await store.writeJson(activePath, dispatchData);

    // Embed更新
    const { buildVcControlEmbed } = require('../../utils/配車/vcControlEmbedBuilder');
    const newEmbed = buildVcControlEmbed(dispatchData);

    // ボタンの状態管理 (仕様: 押した人は再押下不可、両方(全員)済んだら無効化)
    // ただしDiscordのボタンは共有。ここでは「全員完了したかどうか」で判定するのが現実的。
    // ラベルに更新を入れる。
    const currentComponents = interaction.message.components;
    const newComponents = currentComponents.map((row) => {
      const newRow = ActionRowBuilder.from(row);
      newRow.components.forEach((component) => {
        if (component.customId === interaction.customId) {
          // 送迎開始ボタンの場合
          let label = component.label;
          if (isDriver && !label.includes('送迎者済')) label += '(送迎者済)';
          if (isUser && !label.includes('利用者済')) label += '(利用者済)';
          if (carpoolIndex >= 0 && !label.includes(`相乗り${carpoolIndex + 1}済`)) {
            label += `(相乗り${carpoolIndex + 1}済)`;
          }
          component.setLabel(label);

          // 全員済んだかチェック
          const allCarpoolDone = (dispatchData.carpoolUsers || []).every(u => u.startTime);
          if (dispatchData.driverStartTime && dispatchData.userStartTime && allCarpoolDone) {
            component.setDisabled(true);
            component.setStyle(ButtonStyle.Secondary);
          }
        }
      });
      return newRow;
    });

    await interaction.editReply({ embeds: [newEmbed], components: newComponents });
  } catch (error) {
    console.error('送迎開始エラー:', error);
    await interaction
      .followUp({ content: '⚠️ エラーが発生しました。', flags: 64 })
      .catch(() => null);
  }
};
