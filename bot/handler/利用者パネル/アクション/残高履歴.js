const { getCreditHistory } = require('../../utils/creditHistoryStore');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * クレジット残高履歴を表示する
 */
async function showCreditHistory(interaction, client) {
    return autoInteractionTemplate(interaction, {
        ack: ACK.REPLY,
        async run(interaction) {
            const guildId = interaction.guildId;
            const userId = interaction.user.id;

            const history = await getCreditHistory(guildId, userId, 10);

            const embed = buildPanelEmbed({
                title: '💳 クレジット残高履歴 (直近10件)',
                description: history.length === 0
                    ? '最近の取引履歴はありません。'
                    : '最新の取引から表示しています。',
                color: 0x3498db,
                client
            });

            if (history.length > 0) {
                const lines = history.map(h => {
                    const date = new Date(h.timestamp);
                    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                    const sign = h.amount > 0 ? '+' : '';
                    return `▫️ **${dateStr}** | ${h.reason}\n   💰 **${sign}${h.amount.toLocaleString()}** (残高: ${h.balance.toLocaleString()})`;
                });

                embed.addFields({
                    name: '取引明細',
                    value: lines.join('\n'),
                    inline: false
                });
            }

            await interaction.editReply({
                embeds: [embed],
                ephemeral: true
            });
        }
    });
}

module.exports = { showCreditHistory };
