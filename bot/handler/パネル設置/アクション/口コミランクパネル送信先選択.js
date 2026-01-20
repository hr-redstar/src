const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { installPanel } = require('../共通/設置テンプレ');
const { updatePanelSetupPanel } = require('../メイン');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

const { CUSTOM_ID, MessageFlags } = require('../共通/_panelSetupCommon');

module.exports = {
  customId: CUSTOM_ID.SELECT_RATING_RANK_PANEL_CHANNEL,
  type: 'channelSelect',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.UPDATE,
      adminOnly: true,
      async run(interaction) {
        const channelId = interaction.values[0];
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
          return interaction.followUp({
            content: '❌ 指定されたチャンネルが見つかりませんでした。',
            flags: MessageFlags.Ephemeral,
          });
        }

        const guild = interaction.guild;
        const ok = await installPanel({
          interaction,
          panelKey: 'ratingRank',
          panelName: '口コミランクパネル',
          channel,
          buildMessage: async () => {
            const {
              buildRatingRankPanelMessage,
            } = require('../../管理者パネル/口コミランクパネル構築');
            return buildRatingRankPanelMessage(interaction.guild);
          },
        });

        if (ok) {
          await updatePanelSetupPanel(guild);
          await interaction.followUp({
            content: `✅ <#${channel.id}> に口コミランクパネルを設置しました。`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.followUp({
            content: `❌ 口コミランクパネルの送信に失敗しました。`,
            flags: MessageFlags.Ephemeral,
          });
        }
      },
    });
  },
};
