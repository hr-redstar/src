const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { EmbedBuilder, Colors } = require('discord.js');
const updateOperatorPanel = require('./updatePanel');

/**
 * 方面詳細登録完了 - モーダル送信後の処理
 */
module.exports = {
  customId: 'op|directions|sub=detail_modal',
  type: 'modalSubmit',
  async execute(interaction, params) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      adminOnly: true,
      async run(interaction) {
        const guildId = interaction.guildId;
        const key = params.key; // "1行目" など
        const detailText = interaction.fields.getTextInputValue('direction_detail');

        if (!key) {
          return interaction.editReply({
            content: '❌ 対象の方面が不明です。最初からやり直してください。',
          });
        }

        // 方面詳細情報を読み込む
        const detailsPath = paths.directionsDetailsJson(guildId);
        const directionDetails = await store.readJson(detailsPath, {});

        // 更新
        directionDetails[key] = detailText;

        // 保存
        await store.writeJson(detailsPath, directionDetails);

        // 方面リストを読み込んで名前を取得（表示用）
        const dirListPath = paths.directionsListJson(guildId);
        const directionsList = await store.readJson(dirListPath, []);
        const index = parseInt(key) - 1;
        const directionNames = directionsList[index]?.name || key;

        const embed = new EmbedBuilder()
          .setTitle('✅ 方面詳細登録完了')
          .setDescription(`**${directionNames}** の詳細情報を更新しました。`)
          .addFields({
            name: '登録内容',
            value: `\`\`\`\n${detailText}\n\`\`\``,
          })
          .setColor(Colors.Green)
          .setTimestamp();

        await interaction.editReply({
          embeds: [embed],
          components: [],
        });

        // パネルを更新
        const guild = interaction.guild;
        const client = interaction.client;
        await updateOperatorPanel(guild, client);
      },
    });
  },
};
