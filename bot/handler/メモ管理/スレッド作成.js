/**
 * スレッド作成ボタンのハンドラー
 */
module.exports = async (interaction) => {
  const period = interaction.customId.split(':')[2]; // memo:thread:1week → 1week

  const periodLabels = {
    '1week': '1週間',
    '2week': '2週間',
    '1month': '1か月',
    '6month': '半年',
    none: 'なし',
  };

  const label = periodLabels[period] || period;

  // 設定を保存（将来的に実装）
  // TODO: メモチャンネルのスレッド作成設定をGCSに保存

  await interaction.update({
    content: `✅ スレッド作成設定を **${label}** に設定しました。`,
    embeds: [],
    components: [],
  });
};
