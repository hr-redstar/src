// handler/相乗り/却下理由処理.js
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
} = require('discord.js');
const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = {
    execute: async function (interaction, client, parsed) {
        // carpool|reject_reason|rid={rideId}&uid={userId}
        const rideId = parsed?.params?.r || parsed?.params?.rid;
        const userId = parsed?.params?.u || parsed?.params?.uid;

        // rideId が timestamp_userId_guildId 形式ならそこから抽出
        const guildIdFromRideId = rideId?.split('_')?.[2];
        const guildId = interaction.guildId || parsed?.params?.gid || guildIdFromRideId;

        const reason = interaction.values[0];

        if (reason === 'message_input') {
            const modal = new ModalBuilder()
                .setCustomId(`carpool|reject|sub=modal&r=${rideId}&u=${userId}`)
                .setTitle('却下理由入力');

            const reasonInp = new TextInputBuilder()
                .setCustomId('input|reason')
                .setLabel('理由')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInp));
            return interaction.showModal(modal);
        }

        // 理由選択済みの場合は即通知
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            async run(interaction) {
                await notifyRejection(interaction, userId, reason, rideId, guildId);
            }
        });
    },
};

async function notifyRejection(interaction, userId, reason, rideIdArg = null, guildIdArg = null) {
    const guildId = guildIdArg || interaction.guildId;
    const rideId = rideIdArg;
    const guild = interaction.guild || (guildId ? await interaction.client.guilds.fetch(guildId).catch(() => null) : null);

    await interaction.editReply({ content: `✅ 却下しました (理由: ${reason})`, components: [] });

    // 保留中のリクエストを削除 (クリーンアップ)
    const store = require('../../utils/ストレージ/ストア共通');
    const paths = require('../../utils/ストレージ/ストレージパス');
    const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
    const rideData = await store.readJson(activePath).catch(() => null);
    if (rideData && rideData.pendingCarpoolRequests) {
        delete rideData.pendingCarpoolRequests[userId];
        await store.writeJson(activePath, rideData);
    }

    if (!guild) return;

    const requester = await guild.members.fetch(userId).catch(() => null);
    const buildPanelEmbed = require('../../utils/embed/embedTemplate');
    if (requester) {
        const embed = buildPanelEmbed({
            title: '❌ 相乗りリクエスト却下',
            description: '申し訳ありません。ドライバーの判断により相乗りリクエストが受理されませんでした。',
            color: 0xff0000,
            client: interaction.client,
            fields: [
                { name: '📍 却下理由', value: reason, inline: false }
            ]
        });
        await requester.send({ embeds: [embed] }).catch(() => null);
    }

    // ログ出力
    const logEmbed = buildPanelEmbed({
        title: '❌ 相乗り却下',
        description: '相乗りリクエストがドライバーにより却下されました。',
        color: 0xff0000,
        client: interaction.client,
        fields: [
            { name: '🚗 ドライバー', value: `<@${interaction.user.id}>`, inline: true },
            { name: '👤 利用者', value: `<@${userId}>`, inline: true },
            { name: '📍 却下理由', value: reason, inline: false }
        ]
    });

    await postOperatorLog({
        guild: guild,
        embeds: [logEmbed],
    }).catch(() => null);

}
