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

      // 強制退勤ユーティリティを流用（自分自身で実行）
      const forceOffDriver = require('../../../utils/attendance/forceOffDriver');
      const { profile, clearedDispatch } = await forceOffDriver({
        guild: interaction.guild,
        driverId: userId,
        executor: interaction.user,
      });

      if (!profile) {
        return interaction.editReply({
          content: '送迎者登録が見つかりません。先に登録してください。',
        });
      }

      // 各パネルを更新
      const { updateUserPanel } = require('../../利用者パネル/メイン');
      const updateRideListPanel = require('../../送迎処理/一覧パネル更新');
      const { postGlobalLog } = require('../../../utils/ログ/グローバルログ');

      // 待機中の台数を再取得
      const { getQueue } = require('../../../utils/配車/待機列マネージャ');
      const queue = await getQueue(guildId);
      const activeCount = queue.length;

      // グローバルログ送信
      const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
      const embed = buildPanelEmbed({
        title: '🛑 送迎車 退勤通知',
        description: `送迎車が一台退勤しました。\n現在の待機台数：**${activeCount}** 台`,
        color: 0xe74c3c,
        client: interaction.client
      });

      await postGlobalLog({
        guild: interaction.guild,
        content: '【退勤】送迎車がオフラインになりました。',
        embeds: [embed],
      }).catch(() => null);

      await Promise.all([
        updateDriverPanel(interaction.guild, interaction.client),
        updateUserPanel(interaction.guild, interaction.client),
        updateRideListPanel(interaction.guild, interaction.client),
      ]).catch((err) => console.error('パネル更新失敗', err));

      // ユーザーへの通知 (Ephemeral)
      await interaction.editReply({ content: 'お疲れ様でした。退勤しました。' });
    },
  });
};
