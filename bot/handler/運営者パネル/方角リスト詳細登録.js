const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 方角リスト詳細登録 - 方角選択 → 詳細入力
 */
module.exports = {
  customId: 'op|directions|sub=detail_register',
  type: 'button',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      adminOnly: true,
      async run(interaction) {
        const guildId = interaction.guildId;

        // 現在の方角リストを読み込む
        const dirListPath = paths.directionsListJson(guildId);
        const directionsList = await store.readJson(dirListPath, []);

        if (!directionsList || directionsList.length === 0) {
          return interaction.editReply({
            content: '❌ 方角リストが見つかりません。\n先に「➕ 方角リスト登録」で方角を登録してください。',
          });
        }

        // Select Menu を作成
        const select = new StringSelectMenuBuilder()
          .setCustomId('op|directions|modal=detail_select')
          .setPlaceholder('方角を選択してください')
          .setMinValues(1)
          .setMaxValues(1);

        // 方角リストの各項目をオプションとして追加
        directionsList.forEach((dir) => {
          select.addOptions({
            label: dir.name || dir,
            value: dir.id || dir,
            description: `${dir.name || dir} の詳細情報を設定`,
          });
        });

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.editReply({
          content: '📝 詳細情報を設定する方角を選択してください：',
          components: [row],
        });
      },
    });
  },
};
