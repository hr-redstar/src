const { EmbedBuilder } = require('discord.js');
const interactionTemplate = require('../共通/interactionTemplate');
const { ACK } = interactionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const {
  buildCarpoolAnnouncementEmbed,
  buildCarpoolAnnouncementComponents,
} = require('./埋め込み作成');
const { postOperatorLog } = require('../../utils/ログ/運営者ログ');

/**
 * 相乗りキャンセルボタン押下時の処理
 */
module.exports = {
  customIdPrefix: 'carpool:cancel:',
  async execute(interaction, parsed) {
    return interactionTemplate(interaction, {
      ack: ACK.REPLY,
      async run(interaction) {
        const rideId = parsed?.params?.rid;
        const type = parsed?.params?.role; // 'requester' or 'driver'

        const guildId = interaction.guildId;
        const ridePath = `${paths.carpoolDir(guildId)}/${rideId}.json`;
        const rideData = await store.readJson(ridePath).catch(() => null);

        if (!rideData || rideData.status !== 'active') {
          return interaction.editReply({ content: '⚠️ この相乗り募集は既に終了しています。' });
        }

        if (type === 'requester') {
          // 利用者本人がキャンセル
          const userIndex = rideData.carpoolUsers.findIndex(
            (u) => u.userId === interaction.user.id
          );
          if (userIndex === -1) {
            return interaction.editReply({ content: '⚠️ あなたはこの相乗りに参加していません。' });
          }

          const cancelledUser = rideData.carpoolUsers.splice(userIndex, 1)[0];
          rideData.currentUsers -= cancelledUser.count || 1;

          await store.writeJson(ridePath, rideData);

          // 告知メッセージの更新
          const channel = await interaction.guild.channels
            .fetch(rideData.channelId)
            .catch(() => null);
          if (channel) {
            const message = await channel.messages.fetch(rideData.messageId).catch(() => null);
            if (message) {
              const isFull = rideData.currentUsers >= rideData.capacity;
              const embed = buildCarpoolAnnouncementEmbed({
                ...rideData,
                botName: interaction.client.user.username,
                isFull,
              });
              const components = buildCarpoolAnnouncementComponents(isFull, rideId);
              await message.edit({ embeds: [embed], components }).catch(() => null);
            }
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
          await postOperatorLog({
            guild: interaction.guild,
            embeds: [
              new EmbedBuilder()
                .setTitle('⚠️ 相乗りキャンセル')
                .setColor(0xe67e22)
                .setDescription(`<@${interaction.user.id}> が相乗りをキャンセルしました。`)
                .setTimestamp(),
            ],
          });
        }
      },
    });
  },
};
