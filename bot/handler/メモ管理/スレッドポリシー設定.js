const { saveDriver, loadDriver } = require('../../utils/driversStore');

/**
 * スレッドポリシー設定のSelect Menuハンドラー
 */
module.exports = async (interaction) => {
  const selected = interaction.values[0]; // 選択された値: none, 1w, 2w, 1m, 6m

  const labels = {
    none: 'スレッド作成しない',
    '1w': '1週間ごと',
    '2w': '2週間ごと',
    '1m': '1か月ごと',
    '6m': '半年ごと',
  };

  const label = labels[selected] || selected;

  // threadPolicyを保存
  const driver = await loadDriver(interaction.guild.id, interaction.user.id);
  if (driver) {
    const threadPolicy =
      selected === 'none' ? { enabled: false, range: null } : { enabled: true, range: selected };

    // driversStore経由で保存（履歴構造を維持）
    await saveDriver(interaction.guild.id, interaction.user.id, {
      ...driver,
      threadPolicy,
    });
  }

  await interaction.update({
    content: `✅ スレッド設定を **${label}** に設定しました。`,
    embeds: [],
    components: [],
  });
};
