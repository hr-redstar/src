const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const updateOperatorPanel = require('./updatePanel');

/**
 * 方面リスト登録完了 - データを永続化
 */
module.exports = {
  customId: 'op|directions|sub=modal',
  type: 'modalSubmit',
  async execute(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      adminOnly: true,
      async run(interaction) {
        const input = interaction.fields.getTextInputValue('direction_list');

        // 各行をパース、空行を削除して名称を取り出す
        const lines = input.split('\n').filter((l) => l.trim().length > 0);
        const directions = lines.map((line) => {
          // 名称から【】を除去して保存
          const cleanName = line.replace(/^\d+\.\s*/, '').replace(/【|】/g, '').trim();
          return {
            name: cleanName,
            enabled: true,
          };
        });

        if (directions.length === 0) {
          return interaction.editReply({
            content: '❌ 方面を1つ以上入力してください。',
          });
        }

        // 保存
        const dirListPath = paths.directionsListJson(interaction.guildId);
        await store.writeJson(dirListPath, directions);

        const embed = buildPanelEmbed({
          title: '[管理] 方面リスト登録完了',
          description: '方面リストを以下の通り更新しました。',
          fields: [
            {
              name: '登録された方面',
              value: directions.map((d, i) => `${i + 1}. ${d.name}`).join('\n') || 'なし',
            }
          ],
          type: 'success',
          client
        });

        await interaction.editReply({
          embeds: [embed],
          components: [],
        });

        // 運営用パネルを更新
        await updateOperatorPanel(interaction.guild, client);
      },
    });
  },
};
