const { showInquiryModal } = require('./InquiryModal');
const { handleInquirySubmit } = require('./InquiryHandler');
const autoInteractionTemplate = require('./autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 問い合わせ関連のルーティング
 */
async function execute(interaction, client, parsed) {
    if (parsed.action === 'start') {
        return await showInquiryModal(interaction);
    }
    if (parsed.action === 'submit') {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            async run(interaction) {
                await handleInquirySubmit(interaction);
            }
        });
    }
}

module.exports = { execute };
