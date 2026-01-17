/**
 * スレッド作成ボタンのハンドラー
 */
module.exports = async (interaction, client, parsed) => {
  // Custom ID: memo|thread|period=1week
  const period = parsed.params?.period || parsed.params?.legacy?.[0];

  const periodLabels = {
    '1week': '1週間',
    '2week': '2週間',
    '1month': '1か月',
    '6month': '半年',
    none: 'なし',
  };

  const label = periodLabels[period] || period;

  // 期間キーの正規化 (1week -> 1w)
  const mapToStoreParams = {
    '1week': '1w',
    '2week': '2w',
    '1month': '1m',
    '6month': '6m',
    'none': 'none'
  };
  const storeParam = mapToStoreParams[period] || period;

  // 設定を保存
  const { loadDriver, saveDriver } = require('../../utils/driversStore');
  const driver = await loadDriver(interaction.guild.id, interaction.user.id);

  if (driver) {
    const threadPolicy = storeParam === 'none'
      ? { enabled: false, range: null }
      : { enabled: true, range: storeParam };

    await saveDriver(interaction.guild.id, interaction.user.id, {
      ...driver,
      threadPolicy
    });
  }

  await interaction.update({
    content: `✅ スレッド作成設定を **${label}** に設定しました。`,
    embeds: [],
    components: [],
  });
};
