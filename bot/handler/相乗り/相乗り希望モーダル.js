// handler/相乗り/相乗り希望モーダル.js
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = {
  execute: async function (interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.REPLY,
      async run(interaction) {
        const rideId = parsed?.params?.rid;
        const direction = parsed?.params?.dir || '不明';
        const userId = interaction.user.id; // 相乗り希望者
        const guildId = interaction.guildId;

        const location = interaction.fields.getTextInputValue('input|carpool|location') || '(未入力)';
        const countStr = interaction.fields.getTextInputValue('input|carpool|count');
        const count = parseInt(countStr) || 1;

        // 配車データの読み込み
        const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
        const rideData = await store.readJson(activePath).catch(() => null);

        if (!rideData) {
          await interaction.editReply('❌ 送迎データが見つかりませんでした。');
          return;
        }

        const { sendCarpoolRequestToDriver } = require('./carpoolNotifyDriver');

        try {
          await sendCarpoolRequestToDriver({
            guild: interaction.guild,
            client,
            rideId,
            direction,
            location,
            userId,
            count
          });

          await interaction.editReply(
            '✅ ドライバーに相乗りリクエストを送信しました。\n承認されるまでしばらくお待ちください。'
          );
        } catch (e) {
          console.error('相乗りリクエスト送信失敗', e);
          await interaction.editReply(
            `❌ ${e.message || 'ドライバーへのリクエスト送信に失敗しました（DM拒否設定など）。'}`
          );
        }
      },
    });
  },
};
