// handler/利用者パネル/アクション/送迎依頼.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = async function (interaction) {
  return autoInteractionTemplate(interaction, {
    ack: ACK.NONE,
    async run(interaction) {
      // 登録情報を取得
      const { loadUser } = require('../../../utils/usersStore');
      const userData = await loadUser(interaction.guildId, interaction.user.id);

      const defaultAddress = userData?.address || '';
      const defaultMark = userData?.mark || '';

      const modal = new ModalBuilder()
        .setCustomId('user:ride:request:modal')
        .setTitle('送迎の依頼');

      const addressInp = new TextInputBuilder()
        .setCustomId('input:ride:address')
        .setLabel('店舗住所')
        .setStyle(TextInputStyle.Short)
        .setValue(defaultAddress)
        .setRequired(true)
        .setMaxLength(100);

      const markInp = new TextInputBuilder()
        .setCustomId('input:ride:mark')
        .setLabel('駐車目印')
        .setStyle(TextInputStyle.Short)
        .setValue(defaultMark)
        .setRequired(true)
        .setMaxLength(100);

      const destInp = new TextInputBuilder()
        .setCustomId('input:ride:to')
        .setLabel('目的地')
        .setStyle(TextInputStyle.Short)
        .setValue('口頭で伝える')
        .setRequired(true)
        .setMaxLength(50);

      modal.addComponents(
        new ActionRowBuilder().addComponents(addressInp),
        new ActionRowBuilder().addComponents(markInp),
        new ActionRowBuilder().addComponents(destInp)
      );

      await interaction.showModal(modal);
    },
  });
};
