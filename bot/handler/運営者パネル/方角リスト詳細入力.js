const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 方角リスト詳細登録 - Select Menu 選択後、詳細入力モーダル表示
 */

// 一時保存用キャッシュ （ユーザー毎の方角IDを一時保持）
const userDirectionCache = new Map();

module.exports = {
  customId: 'op|directions|modal=detail_select',
  type: 'stringSelect',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: 'none', // モーダルを表示するため defer しない
      adminOnly: true,
      async run(interaction) {
        const selectedDirectionId = interaction.values[0];
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // 方角リストを読み込み、選択された方角を確認
        const dirListPath = paths.directionsListJson(guildId);
        const directionsList = await store.readJson(dirListPath, []);

        const selectedDir = directionsList.find(
          (d) => d.id === selectedDirectionId || d === selectedDirectionId
        );

        if (!selectedDir) {
          return interaction.reply({
            content: '❌ 選択された方角が見つかりません。',
            flags: 64, // Ephemeral
          });
        }

        // ユーザーの一時キャッシュに方角IDを保持
        userDirectionCache.set(userId, {
          guildId,
          directionId: selectedDirectionId,
          directionName: selectedDir.name || selectedDir,
          timestamp: Date.now(),
        });

        // 既存の詳細情報を読み込む
        const detailsPath = paths.directionsDetailsJson(guildId);
        const dirDetails = await store.readJson(detailsPath, {});
        const existingDetail = dirDetails[selectedDirectionId] || '';

        // モーダルを作成（方角IDを含めないシンプルな形式）
        const modal = new ModalBuilder()
          .setCustomId('op|directions|modal=detail_submit')
          .setTitle(`${selectedDir.name || selectedDir} - 詳細情報設定`);

        const detailInput = new TextInputBuilder()
          .setCustomId('detail_content')
          .setLabel('詳細情報（複数行可）')
          .setPlaceholder('例:\n・〇〇通り\n・△△団地\n・□□工業団地')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setValue(existingDetail)
          .setMaxLength(2000);

        modal.addComponents(new ActionRowBuilder().addComponents(detailInput));

        await interaction.showModal(modal);
      },
    });
  },
};

module.exports.getUserDirectionCache = () => userDirectionCache;
