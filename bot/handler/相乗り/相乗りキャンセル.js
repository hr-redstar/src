const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { postOperatorLog } = require('../../utils/ログ/運営者ログ');

/**
 * 相乗りキャンセルボタン押下時の処理
 */
module.exports = {
  async execute(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      async run(interaction) {
        const rideId = parsed?.params?.rid;
        const type = parsed?.params?.role; // 'requester' or 'driver'

        const guildId = interaction.guildId;
        const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
        const rideData = await store.readJson(activePath).catch(() => null);

        if (!rideData) {
          return interaction.editReply({ content: '⚠️ 送迎データが見つからないか、既に終了しています。' });
        }

        if (type === 'requester') {
          // 利用者本人がキャンセル
          if (!rideData.carpoolUsers) {
            return interaction.editReply({ content: '⚠️ 相乗り利用者が登録されていません。' });
          }

          const userIndex = rideData.carpoolUsers.findIndex(
            (u) => u.userId === interaction.user.id
          );
          if (userIndex === -1) {
            return interaction.editReply({ content: '⚠️ あなたはこの相乗りに参加していません。' });
          }

          const cancelledUser = rideData.carpoolUsers.splice(userIndex, 1)[0];
          await store.writeJson(activePath, rideData);

          // 相乗り募集メッセージの更新 (相乗りマネージャを利用)
          const { postCarpoolRecruitment } = require('../../utils/配車/相乗りマネージャ');
          await postCarpoolRecruitment(interaction.guild, rideData, interaction.client).catch(() => null);

          // 利用中一覧から削除
          try {
            const userInUsePath = paths.userInUseListJson(guildId);
            const usersInUse = await store.readJson(userInUsePath, []).catch(() => []);
            const updated = usersInUse.filter(id => id !== interaction.user.id);
            await store.writeJson(userInUsePath, updated);
          } catch (e) {
            console.error('利用中一覧更新エラー(キャンセル)', e);
          }

          await interaction.editReply({ content: '✅ 相乗りをキャンセルしました。' });

          // ドライバーへ通知
          const driver = await interaction.client.users.fetch(rideData.driverId).catch(() => null);
          if (driver) {
            await driver
              .send({
                content: `⚠️ 相乗り利用者の <@${interaction.user.id}> さんがキャンセルしました。`,
              })
              .catch(() => null);
          }

          // 運営者ログ
          const buildPanelEmbed = require('../../utils/embed/embedTemplate');
          const logEmbed = buildPanelEmbed({
            title: '⚠️ 相乗りキャンセル',
            description: '相乗り利用者がマッチングをキャンセルしました。',
            color: 0xe67e22,
            client: interaction.client,
            fields: [
              { name: '👤 利用者', value: `<@${interaction.user.id}>`, inline: true },
              { name: '🆔 送迎ID', value: `\`${rideId}\``, inline: true }
            ]
          });

          await postOperatorLog({
            guild: interaction.guild,
            embeds: [logEmbed],
          });
        }
      },
    });
  },
};
