const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const updateOperatorPanel = require('./updatePanel');

/**
 * 利用料設定完了 - データを保存
 */
module.exports = {
    customId: 'op|fee|sub=modal',
    type: 'modalSubmit',
    async execute(interaction, client, parsed) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            adminOnly: true,
            async run(interaction) {
                const feeText = interaction.fields.getTextInputValue('usage_fee');

                // 設定を読み込み
                const config = await loadConfig(interaction.guildId);

                // 利用料を保存
                config.usageFee = feeText;
                await saveConfig(interaction.guildId, config);

                const embed = buildPanelEmbed({
                    title: '[管理] 利用料設定完了',
                    description: `一律利用料を **${feeText}** に設定しました。`,
                    type: 'success',
                    client
                });

                await interaction.editReply({
                    embeds: [embed],
                });

                // パネルを更新
                await updateOperatorPanel(interaction.guild, client);
            },
        });
    },
};
