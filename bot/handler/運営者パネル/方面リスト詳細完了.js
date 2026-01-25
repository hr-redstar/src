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
  async execute(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      adminOnly: true,
      async run(interaction) {
        const guildId = interaction.guildId;
        const key = parsed?.params?.key; // "1行目" など
        const detailText = interaction.fields.getTextInputValue('direction_detail');

        if (!key) {
          return interaction.editReply({
            content: '❌ 対象の方面が不明です。最初からやり直してください。',
          });
        }

        // 方面リストを読み取って現在の名前を取得
        const dirListPath = paths.directionsListJson(guildId);
        const directionsList = await store.readJson(dirListPath, []);
        const index = parseInt(key) - 1;
        const directionName = directionsList[index]?.name ? directionsList[index].name.replace(/【|】/g, '') : key;

        // 方面詳細情報を読み込む
        const detailsPath = paths.directionsDetailsJson(guildId);
        const directionDetails = await store.readJson(detailsPath, {});

        let detailObj = typeof directionDetails[key] === 'object' ? directionDetails[key] : { text: directionDetails[key] };

        // --- スレッド作成/更新ロジック ---
        let thread;
        const targetChannel = interaction.channel; // 現在のパネルチャンネルで作成

        if (detailObj.threadId) {
          thread = await interaction.guild.channels.fetch(detailObj.threadId).catch(() => null);
        }

        const threadPayload = {
          content: [
            `**📍 ${directionName} 詳細（行先方向の町）**`,
            '```',
            detailText,
            '```',
            `※最終更新: <@${interaction.user.id}> (${new Date().toLocaleString('ja-JP')})`
          ].join('\n')
        };

        if (!thread) {
          // 新規作成
          thread = await targetChannel.threads.create({
            name: `${directionName} 案内`,
            autoArchiveDuration: 60,
          });
          await thread.send(threadPayload);
        } else {
          // 既存スレッドの中身を更新（最新メッセージとして送信するか、メッセージを更新するか。確実なのは新規送信）
          await thread.send(threadPayload);
        }

        // 永続化
        directionDetails[key] = {
          text: detailText,
          threadId: thread.id,
          updatedAt: new Date().toISOString()
        };
        await store.writeJson(detailsPath, directionDetails);

        const embed = new EmbedBuilder()
          .setTitle('✅ 方面詳細登録完了')
          .setDescription(`**${directionName}** の情報を更新し、スレッド <#${thread.id}> へ投稿しました。`)
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
