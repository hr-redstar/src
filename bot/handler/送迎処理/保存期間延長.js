const { loadVcState, updateVcState } = require("../../utils/vcStateStore");

const DAY = 1000 * 60 * 60 * 24;

module.exports = async (interaction) => {
    // ボタンが押されたチャンネル（メモチャンネル or VC）から対象のRideを探す
    // vcState: { [vcId]: { memoChannelId: "...", expiresAt: ... } }

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
            content: "⚠️ このチャンネルまたはスレッドは期間延長の対象外です。",
            flags: 64,
        });
    }

    // すでに無期限なら何もしない
    if (ride.expiresAt === null) {
        return interaction.reply({
            content: "ℹ️ このログはすでに無期限保存されています。",
            flags: 64,
        });
    }

    // 無期限化
    await updateVcState(interaction.guildId, vcId, { expiresAt: null });

    // Operator Log
    const { EmbedBuilder } = require("discord.js");
    const { postOperatorLog } = require("../../utils/ログ/運営者ログ");

    await postOperatorLog({
        guild: interaction.guild,
        embeds: [
            new EmbedBuilder()
                .setTitle("送迎ログ操作ログ")
                .setDescription(
                    `**操作：保存期間を無期限に変更**\n` +
                    `実行者：${interaction.user.tag}\n` +
                    `対象：<#${channelId}>\n` +
                    `ルート：${ride.route || '不明'}`
                )
                .setColor(0x5865f2)
                .setTimestamp()
        ]
    });

    await interaction.reply({
        content: "✅ 保存期間を **無期限** に変更しました。",
        flags: 64,
    });
};
