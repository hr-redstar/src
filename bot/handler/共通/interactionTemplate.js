// handler/共通/interactionTemplate.js

const { PermissionFlagsBits, MessageFlags } = require('discord.js');

const ACK = {
    UPDATE: 'update',
    REPLY: 'reply',
    NONE: 'none',
};

const activeInteractions = new Set();

async function interactionTemplate(interaction, options) {
    const {
        ack = ACK.REPLY,
        adminOnly = false,
        run,
    } = options;

    if (activeInteractions.has(interaction.id)) return;
    activeInteractions.add(interaction.id);

    try {
        // ===== ① 権限チェック（ACK前）=====
        if (adminOnly) {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: '⚠️ この操作は管理者専用です。',
                    flags: MessageFlags.Ephemeral,
                }).catch(() => null);
            }
        }

        // ===== ② ACK =====
        if (!interaction.deferred && !interaction.replied) {
            if (ack === ACK.REPLY) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            } else if (ack === ACK.UPDATE) {
                await interaction.deferUpdate();
            }
        }

        // ===== ③ 本処理 =====
        await run(interaction);

    } catch (error) {
        console.error('💥 interactionTemplate error', error);

        try {
            if (interaction.deferred || interaction.replied) {
                if (ack === ACK.UPDATE) {
                    // UPDATE予定だったがエラーなら、なんとかメッセージ出してあげる
                    // ただし update() は一度しか呼べないので、deferred状態なら editReply が無難なことも多い
                    // ここではユーザー提案の通りまずは update か editReply を試みる
                    await interaction.editReply({
                        content: '❌ 処理中にエラーが発生しました。',
                    }).catch(() => null);
                } else {
                    await interaction.editReply({
                        content: '❌ 処理中にエラーが発生しました。',
                    }).catch(() => null);
                }
            } else {
                // ACK前なら reply
                await interaction.reply({
                    content: '❌ 処理中にエラーが発生しました。',
                    flags: MessageFlags.Ephemeral
                }).catch(() => null);
            }
        } catch { }
    } finally {
        activeInteractions.delete(interaction.id);
        setTimeout(() => activeInteractions.delete(interaction.id), 5000);
    }
}

module.exports = interactionTemplate;
module.exports.ACK = ACK;
