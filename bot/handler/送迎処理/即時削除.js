const { PermissionFlagsBits } = require("discord.js");
const { loadVcState, saveVcState } = require("../../utils/vcStateStore");

module.exports = async (interaction) => {
    // 権限チェック (管理者のみ)
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: "⛔ この操作は管理者のみ実行できます。",
            flags: 64, // Ephemeral
        });
    }

    const vcState = await loadVcState(interaction.guildId);
    const channelId = interaction.channelId;

    // VC ID で検索, MemoChannelID で検索, または LogThreadID で検索
    let vcId = Object.keys(vcState).find(key =>
        key === channelId ||
        vcState[key].memoChannelId === channelId ||
        vcState[key].logThreadId === channelId
    );
    let ride = vcId ? vcState[vcId] : null;

    if (!ride) {
        return interaction.reply({
            content: "⚠️ 削除対象のデータが見つかりません。",
            flags: 64,
        });
    }

    // Operator Log (Send before deletion)
    const { EmbedBuilder } = require("discord.js");
    const { postOperatorLog } = require("../../utils/ログ/運営者ログ");

    await postOperatorLog({
        guild: interaction.guild,
        embeds: [
            new EmbedBuilder()
                .setTitle("送迎ログ操作ログ")
                .setDescription(
                    `**操作：即時削除**\n` +
                    `実行者：${interaction.user.tag}\n` +
                    `対象：<#${channelId}>\n` +
                    `ルート：${ride.route || '不明'}`
                )
                .setColor(0xed4245)
                .setTimestamp()
        ]
    });

    // 削除実行
    const targetCh = await interaction.guild.channels.fetch(channelId).catch(() => null);
    if (targetCh) await targetCh.delete("送迎ログ即時削除（管理者）").catch(() => { });

    // Stateから削除
    delete vcState[vcId];
    await saveVcState(interaction.guildId, vcState);
};
