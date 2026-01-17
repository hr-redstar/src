const { installPanel } = require('../共通/設置テンプレ');
const { updatePanelSetupPanel } = require('../メイン');
const { buildAdminPanelMessage } = require('../../管理者パネル/メイン');
const { loadConfig } = require('../../../utils/設定/設定マネージャ');
const interactionTemplate = require('../../共通/interactionTemplate');
const { ACK } = interactionTemplate;

module.exports = {
  customId: 'ps:select:adminPanelChannel',
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
            flags: 64,
          });
        }

        const guild = interaction.guild;
        const ok = await installPanel({
          interaction,
          panelKey: 'admin',
          panelName: '管理者パネル',
          channel,
          buildMessage: async () => {
            const config = await loadConfig(guild.id);
            return buildAdminPanelMessage(guild, config, interaction.client);
          },
        });

        if (ok) {
          await updatePanelSetupPanel(guild);
          await interaction.followUp({
            content: `✅ <#${channel.id}> に管理者パネルを設置しました。`,
            flags: 64,
          });
        } else {
          await interaction.followUp({
            content: `❌ 管理者パネルの送信に失敗しました。`,
            flags: 64,
          });
        }
      },
    });
  },
};
