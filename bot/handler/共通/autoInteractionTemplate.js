const { PermissionFlagsBits, MessageFlags } = require("discord.js");
const logger = require("../../utils/logger");

const ACK = {
    AUTO: "auto",
    NONE: "none",
    REPLY: "reply", // Added back
};

const active = new Set();

async function autoInteractionTemplate(interaction, options) {
    const {
        ack = ACK.AUTO,
        adminOnly = false,
        run,
    } = options;

    if (active.has(interaction.id)) return;
    active.add(interaction.id);

    try {
        // ===== 管理者権限 =====
        if (adminOnly) {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: "⚠️ この操作は管理者専用です。",
                        flags: MessageFlags.Ephemeral,
                    });
                }
                return;
            }
        }

        // ===== ACK（自動判定・1回のみ）=====
        if (ack === ACK.AUTO) {
            if (!interaction.replied && !interaction.deferred) {
                if (interaction.isMessageComponent()) {
                    await interaction.deferUpdate();
                } else {
                    await interaction.deferReply({
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        } else if (ack === ACK.REPLY) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "⏳ 処理中...",
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        // ===== 本処理 =====
        await run(interaction);

    } catch (error) {
        logger.error("💥 autoInteractionTemplate error", error);

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: "❌ 処理中にエラーが発生しました。",
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (_) { }
    } finally {
        active.delete(interaction.id);
        setTimeout(() => active.delete(interaction.id), 5000);
    }
}

module.exports = autoInteractionTemplate;
module.exports.ACK = ACK;
