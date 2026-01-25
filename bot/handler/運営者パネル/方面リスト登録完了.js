const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { EmbedBuilder, Colors } = require('discord.js');
const updateOperatorPanel = require('./updatePanel');

/**
 * 方面リスト登録モーダル送信完了
 */
module.exports = {
  customId: 'op|directions|sub=modal',
  type: 'modalSubmit',
  async execute(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      adminOnly: true,
      async run(interaction) {
        const guildId = interaction.guildId;
        const inputText = interaction.fields.getTextInputValue('direction_name');

        // 改行で分割し、空白行を除去
        const directionNames = inputText
          .split('\n')
          .map((name) => name.trim())
          .filter((name) => name.length > 0);

        if (directionNames.length === 0) {
          return interaction.editReply({
            content: '❌ 方面名を入力してください。',
          });
        }

        // 方面リストを読み込む
        const dirListPath = paths.directionsListJson(guildId);
        const directionsList = await store.readJson(dirListPath, []);

        const added = [];
        const skipped = [];

        for (const directionName of directionNames) {
          // 方面名から【】を除去してクリーンアップ
          const cleanName = directionName.replace(/【|】/g, '');

          // 既存データ内で同じクリーンアップ後の名前があるかチェック
          const existingIndex = directionsList.findIndex(
            (d) => d.name.replace(/【|】/g, '') === cleanName
          );

          if (existingIndex >= 0) {
            // 既存データがあれば、新しい（クリーンアップされた）名前で上書き更新
            directionsList[existingIndex].name = cleanName;
            skipped.push(`${directionName} (既存を上書き修正)`);
          } else {
            // 新規追加（クリーンアップした名前を保存）
            const newDirection = {
              id: `dir_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              name: cleanName,
              enabled: true,
            };
            directionsList.push(newDirection);
            added.push(directionName);
          }
        }

        // 保存（追加がある場合のみ）
        if (added.length > 0) {
          await store.writeJson(dirListPath, directionsList);
        }

        // 確認埋め込み
        const embed = new EmbedBuilder()
          .setTitle('✅ 方面リスト登録完了')
          .setColor(Colors.Green)
          .setTimestamp();

        if (added.length > 0) {
          embed.addFields({
            name: '追加された方面',
            value: added.map((n) => `• ${n}`).join('\n'),
            inline: false,
          });
        }

        if (skipped.length > 0) {
          embed.addFields({
            name: '既に登録済み（スキップ）',
            value: skipped.map((n) => `• ${n}`).join('\n'),
            inline: false,
          });
        }

        if (added.length === 0 && skipped.length > 0) {
          embed.setDescription('❌ すべて既に登録済みです。');
        } else if (added.length > 0) {
          embed.setDescription(`**${added.length}個**の方面を登録しました。`);
        }

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
