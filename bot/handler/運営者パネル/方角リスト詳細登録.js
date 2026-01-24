const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  Colors,
} = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 方面詳細登録 - 方面選択メニューを表示
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

        // 方面リストを読み込む
        const dirListPath = paths.directionsListJson(guildId);
        const directionsList = await store.readJson(dirListPath, []);

        if (directionsList.length === 0) {
          return interaction.editReply({
            content: '⚠️ まず先に「方面リスト登録」で方面を登録してください。',
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('📍 方面詳細の登録・更新')
          .setDescription('詳細を登録（または更新）したい方向を選んでください。')
          .setColor(Colors.Blue)
          .setTimestamp();

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('op|directions|sub=detail_input')
          .setPlaceholder('方面を選択してください')
          .addOptions(
            directionsList.map((d, index) => ({
              label: `${index + 1}. ${d.name}`,
              value: `${index + 1}行目`, // 内部的には「行目」で正規化
              description: d.name,
            }))
          );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
          embeds: [embed],
          components: [row],
        });
      },
    });
  },
};
