const { installPanel } = require('../共通/設置テンプレ');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { CUSTOM_ID } = require('../共通/_panelSetupCommon');

/**
 * 運営者パネルの送信先設定処理
 */
module.exports = {
  customId: 'ps|select|panel=operator',
  type: 'channelSelect',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      adminOnly: true,
      async run(interaction) {
        const channelId = interaction.values[0];

        await installPanel({
          interaction,
          panelKey: 'operatorPanel',
          channelId,
          panelName: '運営者パネル',
          skipMessage: true,
        });
      },
    });
  },
};
