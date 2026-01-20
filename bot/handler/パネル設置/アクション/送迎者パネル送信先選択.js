const { installPanel } = require('../共通/設置テンプレ');
const { updatePanelSetupPanel } = require('../メイン');
const { buildDriverPanelMessage } = require('../../送迎パネル/メイン');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { CUSTOM_ID, MessageFlags } = require('../共通/_panelSetupCommon');

module.exports = {
  customId: CUSTOM_ID.SELECT_DRIVER_PANEL_CHANNEL,
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
          panelKey: 'driverPanel',
          panelName: '送迎者パネル',
          channel,
          buildMessage: () => buildDriverPanelMessage(guild, 0, interaction.client),
        });

        if (ok) {
          await updatePanelSetupPanel(guild);
          await interaction.followUp({
            content: `✅ <#${channel.id}> に送迎者パネルを設置しました。`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.followUp({
            content: `❌ 送迎者パネルの送信に失敗しました。`,
            flags: MessageFlags.Ephemeral,
          });
        }
      },
    });
  },
};
