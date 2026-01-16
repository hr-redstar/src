const { PermissionFlagsBits } = require('discord.js');

// 二重処理防止
const activeInteractions = new Set();

/**
 * セレクトメニュー専用 Interaction Template
 * @param {Object} interaction
 * @param {Object} options
 * @param {boolean} options.adminOnly
 * @param {function} options.run
 */
async function selectInteractionTemplate(interaction, options) {
    const {
        adminOnly = false,
        run,
    } = options;

    if (activeInteractions.has(interaction.id)) return;
    activeInteractions.add(interaction.id);

    try {
        // ===== ① 権限チェック（ACK前）=====
        if (adminOnly) {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                return interaction.update({
                    content: '⚠️ この操作は管理者専用です。',
                    components: [],
                }).catch(() => null);
            }
        }

        // ===== ② ACK（必ず update）=====
        if (!interaction.deferred && !interaction.replied) {
            // select menu は update しか使わない
            // deferUpdate は不要（update自体がACK）
        }

        // ===== ③ 本処理 =====
        await run(interaction);

    } catch (error) {
        console.error('💥 selectInteractionTemplate error', error);

        try {
            await interaction.update({
                content: '❌ 処理中にエラーが発生しました。',
                components: [],
            }).catch(() => null);
        } catch { }
    } finally {
        activeInteractions.delete(interaction.id);
        setTimeout(() => activeInteractions.delete(interaction.id), 5000);
    }
}

module.exports = selectInteractionTemplate;
