const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const { EmbedBuilder, Colors } = require('discord.js');
const updateOperatorPanel = require('./updatePanel');

/**
 * 利用料設定完了 - モーダル送信後の処理
 */
module.exports = {
    customId: 'op|fee|sub=modal',
    type: 'modalSubmit',
    async execute(interaction) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            adminOnly: true,
            async run(interaction) {
                const guildId = interaction.guildId;
                let feeText = interaction.fields.getTextInputValue('usage_fee');

                // 文字の正規化（全角→半角）
                feeText = feeText.replace(/[！-～]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/ /g, '');

                // Config 読み込み
                const config = await loadConfig(guildId);

                // 更新
                config.usageFee = feeText;

                // 保存
                await saveConfig(guildId, config);

                const embed = new EmbedBuilder()
                    .setTitle('✅ 利用料設定完了')
                    .setDescription(`システムの利用料を **${feeText}** に設定しました。`)
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
