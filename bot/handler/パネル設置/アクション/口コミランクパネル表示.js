const { installPanel } = require('../共通/設置テンプレ');
const { updatePanelSetupPanel } = require('../メイン');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const interactionTemplate = require("../../共通/interactionTemplate");
const { ACK } = interactionTemplate;

module.exports = {
    customId: 'ps:send:Panel_ratingRank',
    type: 'button',
    async execute(interaction) {
        return interactionTemplate(interaction, {
            ack: ACK.REPLY,
            adminOnly: true,
            async run(interaction) {
                const { loadConfig } = require('../../../utils/設定/設定マネージャ');
                const config = await loadConfig(interaction.guildId);

                await installPanel({
                    interaction,
                    panelKey: 'ratingRank',
                    panelName: '口コミランクパネル',
                    channel: interaction.channel,
                    buildMessage: async () => {
                        const embed = new EmbedBuilder()
                            .setTitle('🏆 口コミランクパネル')
                            .setDescription('送迎者・利用者の口コミ評価を確認し、ランク階級の登録・設定を行う管理用パネルです。')
                            .setColor(0xffd700);

                        const row = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('admin:btn:rating_check_start')
                                .setLabel('📊 口コミ確認')
                                .setStyle(ButtonStyle.Primary),
                            new ButtonBuilder()
                                .setCustomId('admin:btn:register_rank_tiers_start')
                                .setLabel('🏷️ ランク階級登録')
                                .setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder()
                                .setCustomId('admin:btn:set_rank_start')
                                .setLabel('⚙️ ランク設定')
                                .setStyle(ButtonStyle.Success)
                        );

                        return { embeds: [embed], components: [row] };
                    }
                });

                await updatePanelSetupPanel(interaction.guild);
            }
        });
    }
};
