// handler/送迎パネル/アクション/現在地更新.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const { updateDriverPanel } = require('../メイン');

module.exports = async function (interaction, parsed) {
  const isModal = parsed?.params?.sub === 'modal';

  return autoInteractionTemplate(interaction, {
    ack: isModal ? ACK.REPLY : ACK.NONE,
    async run(interaction) {
      if (isModal) {
        // --- モーダル送信時 (Modal Submit) ---
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

        return interaction.editReply({
          content: `✅ 現在地を「${location}」に更新しました。${posText}`,
        });
      } else {
        // --- ボタン押下時 (Show Modal) ---
        const modal = new ModalBuilder()
          .setCustomId('driver|location|sub=modal')
          .setTitle('現在地の更新');

        const locInput = new TextInputBuilder()
          .setCustomId('input:driver:location')
          .setLabel('現在の場所')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50);

        modal.addComponents(new ActionRowBuilder().addComponents(locInput));

        await interaction.showModal(modal);
      }
    },
  });
};
