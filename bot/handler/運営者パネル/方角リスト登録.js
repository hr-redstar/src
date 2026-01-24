const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 方面リスト登録 - モーダル表示
 */
module.exports = {
  customId: 'op|directions|sub=list_register',
  type: 'button',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: 'none', // モーダルを表示するため defer しない
      adminOnly: true,
      async run(interaction) {
        const guildId = interaction.guildId;

        // 既存の方面リストを読み込む
        const dirListPath = paths.directionsListJson(guildId);
        let directionsList = await store.readJson(dirListPath, []);

        // 既存データをクリーンアップ：【】を除去
        let needsUpdate = false;
        directionsList = directionsList.map((d) => {
          const cleanName = d.name.replace(/【|】/g, '');
          if (cleanName !== d.name) {
            needsUpdate = true;
            return { ...d, name: cleanName };
          }
          return d;
        });

        // クリーンアップ後、重複を除去（cleanName で比較）
        const uniqueList = [];
        const seenNames = new Set();
        for (const d of directionsList) {
          if (!seenNames.has(d.name)) {
            seenNames.add(d.name);
            uniqueList.push(d);
          }
        }

        // 重複があれば更新フラグを立てる
        if (uniqueList.length !== directionsList.length) {
          needsUpdate = true;
        }

        // 更新が必要ならクリーンアップ後のデータを保存
        if (needsUpdate) {
          await store.writeJson(dirListPath, uniqueList);
        }

        const existingNames = uniqueList.map((d) => d.name).join('\n');

        const modal = new ModalBuilder()
          .setCustomId('op|directions|modal=list_register')
          .setTitle('方面リスト登録');

        const directionInput = new TextInputBuilder()
          .setCustomId('direction_name')
          .setLabel('方面名（改行で複数登録可能 例：北方面\n南方面）')
          .setPlaceholder('北方面\n南方面\n駅方面')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        // 既存の方面があればデフォルト値として設定
        if (existingNames) {
          directionInput.setValue(existingNames);
        }

        modal.addComponents(new ActionRowBuilder().addComponents(directionInput));

        await interaction.showModal(modal);
      },
    });
  },
};
