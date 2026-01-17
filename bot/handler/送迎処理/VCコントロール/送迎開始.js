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
      return interaction.followUp({ content: '⚠️ 送迎データが見つかりません。', ephemeral: true });
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const isDriver = interaction.user.id === dispatchData.driverId;
    const isUser = interaction.user.id === dispatchData.userId;

    if (!isDriver && !isUser) {
      return interaction.followUp({
        content: '⚠️ 送迎者または利用者のみが操作できます。',
        ephemeral: true,
      });
    }

    // 時刻を記録
    if (isDriver) {
      if (dispatchData.driverStartTime)
        return interaction.followUp({ content: '⚠️ 既に開始済みです。', ephemeral: true });
      dispatchData.driverStartTime = timeStr;
      await interaction.channel.send(`※送迎開始：送迎者 <@${interaction.user.id}>`);
    } else {
      if (dispatchData.userStartTime)
        return interaction.followUp({ content: '⚠️ 既に開始済みです。', ephemeral: true });
      dispatchData.userStartTime = timeStr;
      await interaction.channel.send(`※送迎開始：利用者 <@${interaction.user.id}>`);
    }

    // 最初の開始時刻を rideStartedAt に保存
    if (!dispatchData.rideStartedAt) {
      dispatchData.rideStartedAt = now.toISOString();
      dispatchData.status = 'in-progress';
    }

    // データを保存
    await store.writeJson(activePath, dispatchData);

    // Embed更新 (Fields)
    const currentEmbed = interaction.message.embeds[0];
    const newEmbed = EmbedBuilder.from(currentEmbed);

    // Fields: [0]=Driver, [1]=User
    const fields = newEmbed.data.fields || [];

    if (isDriver) {
      // index 0: 送迎者
      if (fields[0]) {
        fields[0].value = fields[0].value.replace(
          /送迎開始時間：--:--/,
          `送迎開始時間：${timeStr}`
        );
      }
    } else {
      // index 1: 利用者
      if (fields[1]) {
        fields[1].value = fields[1].value.replace(
          /送迎開始時間：--:--/,
          `送迎開始時間：${timeStr}`
        );
      }
    }
    newEmbed.setFields(fields);

    // ボタン更新 (押した人のボタンを無効化したいが、同一IDのボタンを共有しているため
    // 「送迎開始」ボタンは両者が押すまで有効にしておく必要がある？
    // 仕様: "押した本人側の...再押下不可" -> つまり、Driverが押したらDriverに対して無効化？
    // Discordのボタンは全員にて対して同じ状態。
    // つまり、Driverが押したら「Driver済」状態にする必要があるが、ボタンは1つ。
    // ボタンを「送迎開始(送迎者済)」のようにラベル変えるか、
    // もしくは「送迎開始」ボタンは押すと「あなたは既に押しました」とエラーにするだけで、見た目は変えない？
    // しかし仕様には「そのユーザーに対して ボタン無効化」とある。
    // これを実現するには、送迎者用ボタンと利用者用ボタンを分けるか、
    // またはインタラクションでEphemeralに「完了」を出すしかない。
    // 今回の仕様のボタン構成は [向かっています][送迎開始][送迎終了] の3つ。
    // したがって、ボタン自体を無効化すると相手も押せなくなる。
    // なので、「ボタン無効化」は「両方押したら無効化」とするのが現実的。
    // 片方だけの時は、押した本人には「記録しました」と返し、もう一度押そうとしたら「記録済みです」と返す（実装済み）。
    // ラベルに「送迎開始(送迎者済)」などを追記するアプローチをとる。

    const currentComponents = interaction.message.components;
    const newComponents = currentComponents.map((row) => {
      const newRow = new ActionRowBuilder();
      row.components.forEach((component) => {
        const btn = ButtonBuilder.from(component);
        if (btn.data.custom_id === interaction.customId) {
          // 送迎開始ボタンの場合
          let label = btn.data.label;
          if (isDriver && !label.includes('送迎者済')) {
            label += '(送迎者済)';
          }
          if (isUser && !label.includes('利用者済')) {
            label += '(利用者済)';
          }
          btn.setLabel(label);

          // 両方済んだら無効化
          if (label.includes('送迎者済') && label.includes('利用者済')) {
            btn.setDisabled(true);
            btn.setStyle(ButtonStyle.Secondary); // 色を変える
          }
        }
        newRow.addComponents(btn);
      });
      return newRow;
    });

    await interaction.editReply({ embeds: [newEmbed], components: newComponents });
  } catch (error) {
    console.error('送迎開始エラー:', error);
    await interaction
      .followUp({ content: '⚠️ エラーが発生しました。', ephemeral: true })
      .catch(() => null);
  }
};
