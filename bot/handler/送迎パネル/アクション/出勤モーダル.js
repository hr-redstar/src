// handler/送迎パネル/アクション/出勤モーダル.js
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const { updateDriverPanel } = require('../メイン');

const interactionTemplate = require("../../共通/interactionTemplate");
const { ACK } = interactionTemplate;

module.exports = async function (interaction) {
  return interactionTemplate(interaction, {
    ack: ACK.REPLY,
    async run(interaction) {
      const guildId = interaction.guildId;
      const userId = interaction.user.id;

      // 入力値取得
      const stopPlace = interaction.fields.getTextInputValue('input:driver:place');
      const carInfo = interaction.fields.getTextInputValue('input:driver:car');
      const capacity = interaction.fields.getTextInputValue('input:driver:capacity');

      // 待機中の送迎者データとして保存
      // パス: GCS/{guildId}/待機中の送迎者/{userId}.json
      const data = {
        userId,
        stopPlace,
        carInfo,
        capacity,
        timestamp: new Date().toISOString(),
      };

      const waitPath = `${paths.waitingDriversDir(guildId)}/${userId}.json`;
      const isAlreadyWaiting = await store.readJson(waitPath).catch(() => null) !== null;

      await store.writeJson(waitPath, data);

      // パネル更新
      const { updateUserPanel } = require('../../利用者パネル/メイン');
      const updateRideListPanel = require('../../送迎処理/一覧パネル更新');
      const { postGlobalLog } = require('../../../utils/ログ/グローバルログ');

      // 待機中の台数を再取得（カウント連動のため）
      const { getQueue, getPosition } = require('../../../utils/配車/待機列マネージャ');
      const queue = await getQueue(guildId);
      const activeCount = queue.length;
      const myPosition = await getPosition(guildId, userId);

      // 初回追加時のみグローバルログに送信
      if (!isAlreadyWaiting) {
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
          .setTitle(`現在の送迎車　${activeCount}台`)
          .setColor(0x00ff00);

        await postGlobalLog({
          guild: interaction.guild,
          content: '送迎車が一台出勤しました。',
          embeds: [embed]
        }).catch(() => null);

        // 詳細ログ（運営者・管理者向け）
        const { postDetailedAttendanceLog } = require('../../../utils/ログ/詳細ログ送信');
        await postDetailedAttendanceLog({
          guild: interaction.guild,
          user: interaction.user,
          data: data,
          type: 'on'
        }).catch(() => null);
      }

      // 更新処理を並列実行
      await Promise.all([
        updateDriverPanel(interaction.guild, interaction.client),
        updateUserPanel(interaction.guild, interaction.client),
        updateRideListPanel(interaction.guild, interaction.client),
      ]).catch(err => console.error("パネル更新失敗", err));

      await interaction.editReply({
        content: `✅ 待機中に追加しました。\n現在の待機順位は **第 ${myPosition} 位** です。`
      });
    }
  });
};
