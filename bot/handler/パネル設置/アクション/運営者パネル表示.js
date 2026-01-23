const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } = require('discord.js');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { CUSTOM_ID } = require('../共通/_panelSetupCommon');

/**
 * パネル設置パネル → 運営者パネルボタン
 * チャンネル選択メニューを表示
 */
module.exports = {
  customId: 'ps|send|panel=operator',
  type: 'button',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      adminOnly: true,
      async run(interaction) {
        const select = new ChannelSelectMenuBuilder()
          .setCustomId('ps|select|panel=operator')
          .setPlaceholder('運営者パネルを送信するチャンネルを選択')
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setMinValues(1)
          .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.editReply({
          content: '📋 運営者パネルを送信するチャンネルを選択してください：',
          components: [row],
        });
      },
    });
  },
};

