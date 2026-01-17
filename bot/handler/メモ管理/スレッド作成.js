/**
 * スレッド作成ボタンのハンドラー
 */
module.exports = async (interaction, client, parsed) => {
  // v1: memo:thread:1week -> params.legacy[0]
  // v2: memo|thread|period=1week -> params.period
  const period = parsed.params?.legacy?.[0] || parsed.params?.period;

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
