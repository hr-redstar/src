const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 方面詳細登録 - モーダル表示 (セレクトメニュー後の処理)
 */
module.exports = {
  customId: 'op|directions|sub=detail_input',
  type: 'selectMenu',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: 'none', // モーダルを表示するため defer しない
      adminOnly: true,
      async run(interaction) {
        const guildId = interaction.guildId;
        const selectedValue = interaction.values[0]; // "1行目" など

        // 方面リストを読み込んで、選択された番号の名前に対応させる
        const dirListPath = paths.directionsListJson(guildId);
        const directionsList = await store.readJson(dirListPath, []);

        const index = parseInt(selectedValue) - 1;
        const direction = directionsList[index];
        const directionName = direction ? direction.name : selectedValue;

        // 既存の詳細情報を読み込む
        const detailsPath = paths.directionsDetailsJson(guildId);
        const directionDetails = await store.readJson(detailsPath, {});
        const existingDetail = directionDetails[selectedValue] || '';

        const modal = new ModalBuilder()
          .setCustomId(`op|directions|sub=detail_modal|key=${selectedValue}`)
          .setTitle(`${directionName} の詳細設定`);

        const detailInput = new TextInputBuilder()
          .setCustomId('direction_detail')
          .setLabel('方面詳細（改行で複数登録可能）')
          .setPlaceholder('詳細な地名や建物名を入力してください')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000);

        if (existingDetail) {
          detailInput.setValue(existingDetail);
        }

        modal.addComponents(new ActionRowBuilder().addComponents(detailInput));

        await interaction.showModal(modal);
      },
    });
  },
};
