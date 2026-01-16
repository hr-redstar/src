// handler/相乗り/却下モーダル.js
const { EmbedBuilder } = require('discord.js');
const interactionTemplate = require("../共通/interactionTemplate");
const { ACK } = interactionTemplate;

module.exports = {
    execute: async function (interaction) {
        return interactionTemplate(interaction, {
            ack: ACK.REPLY,
            async run(interaction) {
                const parts = interaction.customId.split(':');
                const userId = parts[3]; // carpool:reject_modal:{rideId}:{userId}
                const reason = interaction.fields.getTextInputValue('input:reason');

                const requester = await interaction.guild.members.fetch(userId).catch(() => null);
                if (requester) {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ 相乗りリクエスト却下')
                        .setDescription(`申し訳ありません、ドライバーによりリクエストが却下されました。`)
                        .addFields({ name: '理由', value: reason })
                        .setColor(0xFF0000);
                    await requester.send({ embeds: [embed] }).catch(() => null);
                }

                await interaction.editReply(`✅ 却下しました (理由送信済み)`);
            }
        });
    }
};
