const interactionTemplate = require('../../共通/interactionTemplate');
const { ACK } = interactionTemplate;
const { installPanel } = require('../共通/設置テンプレ');
const { CUSTOM_ID } = require('../共通/_panelSetupCommon');

/**
 * グローバルログの送信先設定処理
 */
module.exports = {
    customId: CUSTOM_ID.SELECT_GLOBAL_LOG_CHANNEL,
    type: 'channelSelect',
    async execute(interaction) {
        return interactionTemplate(interaction, {
            ack: ACK.UPDATE,
            adminOnly: true,
            async run(interaction) {
                const channelId = interaction.values[0];

                await installPanel({
                    interaction,
                    panelKey: 'globalLog',
                    channelId,
                    panelName: 'グローバルログ',
                    skipMessage: true
                });
            },
        });
    }
};
