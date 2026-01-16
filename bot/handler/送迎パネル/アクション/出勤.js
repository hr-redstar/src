// handler/送迎パネル/アクション/出勤.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');

const autoInteractionTemplate = require("../../共通/autoInteractionTemplate");
const { ACK } = autoInteractionTemplate;

module.exports = async function (interaction) {
  return autoInteractionTemplate(interaction, {
    ack: ACK.NONE,
    async run(interaction) {
      const { loadDriver } = require('../../../utils/driversStore');
      const userId = interaction.user.id;
      const guildId = interaction.guildId;

      // 1. 現在の待機データ（更新用）を試行
      const waitPath = `${paths.waitingDriversDir(guildId)}/${userId}.json`;
      let currentData = await store.readJson(waitPath).catch(() => null);

      // 2. 待機データがなければプロフィールの登録情報を試行
      if (!currentData) {
        currentData = await loadDriver(guildId, userId);
      }

      // フィールド名のマッピング（プロフィールは stop/car、待機データは stopPlace/carInfo）
      const defaultPlace = currentData?.stopPlace || currentData?.stop || '';
      const defaultCar = currentData?.carInfo || currentData?.car || '';
      const defaultCapacity = currentData?.capacity || '';

      // モーダルを表示
      const modal = new ModalBuilder()
        .setCustomId('driver:on:modal')
        .setTitle('今から行けます（送迎者）');

      const placeInput = new TextInputBuilder()
        .setCustomId('input:driver:place')
        .setLabel('停留場所')
        .setPlaceholder('例：駅南口ロータリー／コンビニ前')
        .setValue(String(defaultPlace))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      const carInput = new TextInputBuilder()
        .setCustomId('input:driver:car')
        .setLabel('車種')
        .setPlaceholder('例：白プリウス 1234')
        .setValue(String(defaultCar))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      const capacityInput = new TextInputBuilder()
        .setCustomId('input:driver:capacity')
        .setLabel('人数')
        .setPlaceholder('例：3人まで')
        .setValue(String(defaultCapacity))
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);

      modal.addComponents(
        new ActionRowBuilder().addComponents(placeInput),
        new ActionRowBuilder().addComponents(carInput),
        new ActionRowBuilder().addComponents(capacityInput)
      );

      await interaction.showModal(modal);
    }
  });
};
