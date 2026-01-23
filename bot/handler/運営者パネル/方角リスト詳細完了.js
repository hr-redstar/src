const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { EmbedBuilder, Colors } = require('discord.js');
const updateOperatorPanel = require('./updatePanel');

/**
 * 方角リスト詳細登録 - モーダル送信完了
 */
module.exports = {
  customId: 'op|directions|modal=detail_submit',
  type: 'modalSubmit',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      adminOnly: true,
      async run(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const detailContent = interaction.fields.getTextInputValue('detail_content');

        // 方角詳細入力モジュールから方角IDのキャッシュを取得
        const detailInputModule = require('./方角リスト詳細入力');
        const userCache = detailInputModule.getUserDirectionCache();
        const cacheData = userCache.get(userId);

        if (!cacheData || cacheData.guildId !== guildId) {
          return interaction.editReply({
            content: '❌ エラー: 方角情報が見つかりません。再度選択からやり直してください。',
          });
        }

        const directionId = cacheData.directionId;
        const directionName = cacheData.directionName;

        // 方角リストから該当する方角のインデックスを取得
        const directionsListPath = paths.directionsListJson(guildId);
        const directionsList = await store.readJson(directionsListPath, []);
        const lineNumber = directionsList.findIndex(d => d.id === directionId) + 1; // 1行目、2行目...

        if (lineNumber === 0) {
          return interaction.editReply({
            content: '❌ エラー: 方角が見つかりません。',
          });
        }

        // 詳細情報を保存 (キーは "1行目", "2行目", ...)
        const detailsPath = paths.directionsDetailsJson(guildId);
        const dirDetails = await store.readJson(detailsPath, {});

        dirDetails[`${lineNumber}行目`] = detailContent || '';

        await store.writeJson(detailsPath, dirDetails);

        // キャッシュを消鹿
        userCache.delete(userId);

        // 確認埋め込み
        const embed = new EmbedBuilder()
          .setTitle('✅ 方角リスト詳細情報保存完了')
          .setDescription(`**${directionName}** の詳細情報を保存しました。`)
          .addFields({
            name: '詳細内容',
            value: detailContent || '（未記入）',
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
