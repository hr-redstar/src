// handler/ガイド/メイン.js
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const { buildPrivateVcGuide } = require('./プライベートVC');
const { buildUserMemoGuide } = require('./個人メモ');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

async function execute(interaction, client, parsed) {
    const action = parsed.action; // vc or memo

    return autoInteractionTemplate(interaction, {
        ack: ACK.REPLY_EPHEMERAL,
        async run(interaction) {
            const config = await loadConfig(interaction.guildId);
            let payload;

            if (action === 'vc') {
                const categoryId = config.categories?.privateVc;
                const category = categoryId ? await interaction.guild.channels.fetch(categoryId).catch(() => null) : null;
                const guide = buildPrivateVcGuide(category);
                payload = guide.content;
            } else if (action === 'memo') {
                const categoryId = config.categories?.userMemo;
                const category = categoryId ? await interaction.guild.channels.fetch(categoryId).catch(() => null) : null;
                const guide = buildUserMemoGuide(category);
                payload = guide.content;
            }

            if (payload) {
                return interaction.editReply(payload);
            } else {
                return interaction.editReply({ content: '❌ 情報を取得できませんでした。' });
            }
        }
    });
}

module.exports = { execute };
