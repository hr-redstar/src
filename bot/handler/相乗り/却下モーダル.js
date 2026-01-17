// handler/相乗り/却下モーダル.js
const { EmbedBuilder } = require('discord.js');
const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
const { postGlobalLog } = require('../../utils/ログ/グローバルログ');
const interactionTemplate = require('../共通/interactionTemplate');
const { ACK } = interactionTemplate;

module.exports = {
  execute: async function (interaction, parsed) {
    return interactionTemplate(interaction, {
      ack: ACK.REPLY,
      async run(interaction) {
        const userId = parsed?.params?.uid; // carpool|reject|sub=modal&rid={rideId}&uid={userId}
        const reason = interaction.fields.getTextInputValue('input|reason');

        const requester = await interaction.guild.members.fetch(userId).catch(() => null);
        if (requester) {
          const embed = new EmbedBuilder()
            .setTitle('❌ 相乗りリクエスト却下')
            .setDescription(`申し訳ありません、ドライバーによりリクエストが却下されました。`)
            .addFields({ name: '理由', value: reason })
            .setColor(0xff0000);
          await requester.send({ embeds: [embed] }).catch(() => null);
        }

        // ログ出力
        const logEmbed = new EmbedBuilder()
          .setTitle('❌ 相乗り却下')
          .setDescription(`以下の相乗りリクエストが却下されました。`)
          .addFields(
            { name: 'ドライバー', value: `<@${interaction.user.id}>`, inline: true },
            { name: '希望者', value: `<@${userId}>`, inline: true },
            { name: '理由', value: reason, inline: false }
          )
          .setColor(0xff0000)
          .setTimestamp();

        await postOperatorLog({
          guild: interaction.guild,
          embeds: [logEmbed],
        }).catch(() => null);

        await postGlobalLog({
          guild: interaction.guild,
          embeds: [logEmbed],
        }).catch(() => null);

        await interaction.editReply(`✅ 却下しました (理由送信済み)`);
      },
    });
  },
};
