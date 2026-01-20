const { installPanel } = require('../共通/設置テンプレ');
const { CUSTOM_ID } = require('../共通/_panelSetupCommon');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 相乗りチャンネルの設定処理
 */
module.exports = {
  customId: CUSTOM_ID.SELECT_CARPOOL_PANEL_CHANNEL,
  type: 'channelSelect',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.UPDATE,
      adminOnly: true,
      async run(interaction) {
        const channelId = interaction.values[0];

        await installPanel({
          interaction,
          panelKey: 'carpoolPanel',
          channelId,
          panelName: '相乗り通知先',
          // 相乗りは「パネル」そのものを送るわけではない（通知を飛ばすだけ）ので、メッセージ送信はスキップ
          skipMessage: true,
        });
      },
    });
  },
};
