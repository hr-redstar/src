// handler/送迎パネル/アクション/現在地更新モーダル.js
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const { updateDriverPanel } = require('../メイン');

const interactionTemplate = require('../../共通/interactionTemplate');
const { ACK } = interactionTemplate;

module.exports = async function (interaction) {
  return interactionTemplate(interaction, {
    ack: ACK.REPLY,
    async run(interaction) {
      const guildId = interaction.guildId;
      const userId = interaction.user.id;

      const location = interaction.fields.getTextInputValue('input:driver:location');

      const profilePath = paths.driverProfileJson(guildId, userId);
      await store.updateJson(profilePath, (data) => {
        if (data) {
          data.stopPlace = location;
        }
        return data;
      });

      // 待機中データも更新（もしあれば）
      const waitPath = `${paths.waitingDriversDir(guildId)}/${userId}.json`;
      const waitData = await store.readJson(waitPath).catch(() => null);
      if (waitData) {
        waitData.stopPlace = location;
        await store.writeJson(waitPath, waitData);
      }

      await updateDriverPanel(interaction.guild, interaction.client);

      const { getPosition } = require('../../../utils/配車/待機列マネージャ');
      const myPosition = await getPosition(guildId, userId);
      const posText = myPosition ? `\n現在の待機順位は **第 ${myPosition} 位** です。` : '';

      await interaction.editReply({
        content: `✅ 現在地を「${location}」に更新しました。${posText}`,
      });
    },
  });
};
