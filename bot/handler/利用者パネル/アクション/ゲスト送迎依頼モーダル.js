// handler/利用者パネル/アクション/ゲスト送迎依頼モーダル.js
const store = require('../../../utils/ストレージ/ストア共通');
const updateRideListPanel = require('../../送迎処理/一覧パネル更新');

const interactionTemplate = require("../../共通/interactionTemplate");
const { ACK } = interactionTemplate;

module.exports = async function (interaction) {
    return interactionTemplate(interaction, {
        ack: ACK.REPLY,
        async run(interaction) {
            const guildId = interaction.guildId;
            const userId = interaction.user.id;
            const name = interaction.fields.getTextInputValue('input:guest:name');
            const from = interaction.fields.getTextInputValue('input:ride:from');
            const to = interaction.fields.getTextInputValue('input:ride:to');

            const paths = require('../../../utils/ストレージ/ストレージパス');
            // ゲスト送迎依頼を保存
            const rideRequest = {
                userId,
                name,
                from,
                to,
                timestamp: Date.now(),
                status: 'waiting',
                guest: true
            };
            await store.writeJson(`${paths.waitingUsersDir(guildId)}/${userId}_guest.json`, rideRequest);

            await updateRideListPanel(interaction.guild, interaction.client);

            await interaction.editReply({
                content: `✅ ゲスト(${name}様)の送迎依頼を受け付けました。\n現在地: \`${from}\`\n目的地: \`${to}\`\n\nドライバーが見つかるまでお待ちください。`
            });
        }
    });
};
