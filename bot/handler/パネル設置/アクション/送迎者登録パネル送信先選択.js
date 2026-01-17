const { installPanel } = require('../共通/設置テンプレ');
const { updatePanelSetupPanel } = require('../メイン');
const { buildDriverRegisterPanelMessage } = require('../../登録処理/送迎者登録');
const interactionTemplate = require('../../共通/interactionTemplate');
const { ACK } = interactionTemplate;
const { MessageFlags } = require('discord.js');

module.exports = {
  customId: 'ps|select|panel=driverRegister',
  type: 'channelSelect',
  async execute(interaction) {
    return interactionTemplate(interaction, {
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
          panelKey: 'driverRegister',
          panelName: '送迎者登録パネル',
          channel,
          buildMessage: () => buildDriverRegisterPanelMessage(guild, interaction.client),
        });

        if (ok) {
          await updatePanelSetupPanel(guild);
          await interaction.followUp({
            content: `✅ <#${channel.id}> に送迎者登録パネルを設置しました。`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.followUp({
            content: `❌ 送迎者登録パネルの送信に失敗しました。`,
            flags: MessageFlags.Ephemeral,
          });
        }
      },
    });
  },
};
