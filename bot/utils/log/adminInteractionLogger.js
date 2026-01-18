const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../設定/設定マネージャ');

/**
 * 管理社ログへのインタラクション記録
 * @param {import('discord.js').Interaction} interaction
 * @param {'START'|'ERROR'} phase
 * @param {Object} extra
 */
async function logAdminInteraction(interaction, phase = 'START', extra = {}) {
    // Configから管理者ログスレッドを取得
    const config = await loadConfig(interaction.guildId);
    const threadId = config?.logs?.adminLogThread;
    if (!threadId) return; // 設定がなければ何もしない

    const client = interaction.client;
    const thread = await client.channels.fetch(threadId).catch(() => null);
    if (!thread) return;

    // Embed構築
    const embed = new EmbedBuilder()
        .setTitle('🛠 Bot 操作ログ')
        .setColor(phase === 'ERROR' ? 0xff0000 : 0x3498db)
        .addFields(
            { name: '操作種別', value: interaction.type?.toString() || 'Unknown', inline: true },
            { name: 'ユーザー', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'チャンネル', value: `<#${interaction.channelId}>`, inline: true },
        )
        .setTimestamp();

    if (interaction.isChatInputCommand?.()) {
        embed.addFields({
            name: 'コマンド',
            value: `/${interaction.commandName}`,
            inline: false,
        });
        // オプションがあれば整形して表示
        if (interaction.options?.data?.length > 0) {
            const options = interaction.options.data
                .map((opt) => `${opt.name}: ${opt.value}`)
                .join('\n');
            embed.addFields({ name: 'オプション', value: options });
        }
    }

    if (interaction.isButton?.()) {
        embed.addFields({
            name: 'ボタン',
            value: interaction.customId,
            inline: false,
        });
    }

    if (interaction.isAnySelectMenu?.()) {
        embed.addFields({
            name: 'セレクトメニュー',
            value: `ID: ${interaction.customId}\n選択: ${interaction.values.join(', ')}`,
            inline: false,
        });
    }

    if (interaction.isModalSubmit?.()) {
        const inputs = [];
        interaction.fields.fields.forEach((field) => {
            inputs.push(`**${field.customId}**: ${field.value.slice(0, 100)}`);
        });

        embed.addFields({
            name: 'モーダル送信',
            value: `ID: ${interaction.customId}\n${inputs.join('\n')}`,
            inline: false,
        });
    }

    // 補足情報 (エラー内容など)
    if (extra.message) {
        embed.addFields({ name: '補足 / エラー', value: extra.message });
    }

    // ID追跡用フッター
    embed.setFooter({ text: `interactionId: ${interaction.id}` });

    await thread.send({ embeds: [embed] }).catch((err) => {
        console.error('管理者ログ送信エラー:', err);
    });
}

module.exports = {
    logAdminInteraction,
};
