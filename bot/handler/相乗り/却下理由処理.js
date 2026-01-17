// handler/相乗り/却下理由処理.js
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
} = require('discord.js');
const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
const { postGlobalLog } = require('../../utils/ログ/グローバルログ');
const interactionTemplate = require('../共通/interactionTemplate');
const { ACK } = interactionTemplate;

module.exports = {
    execute: async function (interaction, parsed) {
        // carpool|reject_reason|rid={rideId}&uid={userId}
        const rideId = parsed?.params?.rid;
        const userId = parsed?.params?.uid;
        const reason = interaction.values[0];

        if (reason === 'message_input') {
            const modal = new ModalBuilder()
                .setCustomId(`carpool|reject|sub=modal&rid=${rideId}&uid=${userId}`)
                .setTitle('却下理由入力');

            const reasonInp = new TextInputBuilder()
                .setCustomId('input:reason')
                .setLabel('理由')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInp));
            return interaction.showModal(modal);
        }

        // 理由選択済みの場合は即通知
        await notifyRejection(interaction, userId, reason);
    },
};

async function notifyRejection(interaction, userId, reason) {
    await interaction.update({ content: `✅ 却下しました (理由: ${reason})`, components: [] });
    // 元のメッセージ（DM）のボタンも無効化したいが、DMメッセージの編集権限はBotにあるので可能ならやる
    // しかしinteraction.messageはEphemeralなSelectMenuのメッセージなので、元のDMメッセージではない
    // 元のDMを更新するには別途ロジックが必要だが、複雑になるため一旦割愛

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
}
