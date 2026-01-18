const { parseCustomId } = require('../../utils/parseCustomId');

module.exports = async function handleRideList(interaction) {
    try {
        // Custom ID の解析
        const parsed = parseCustomId(interaction.customId);
        if (!parsed) {
            console.warn('[handler] parseCustomId failed:', interaction.customId);
            return;
        }

        // namespace|action チェック
        if (parsed.namespace !== 'ps' || parsed.action !== 'send') {
            console.warn('[handler] Namespace/action mismatch:', parsed);
            return;
        }

        // panel パラメータ確認
        const panelName = parsed.params.panel;
        if (panelName !== 'rideList') {
            console.warn('[handler] Unknown panel:', panelName);
            return;
        }

        // --- レスポンス送信（安全な reply） ---
        const replyContent = '🚗 配車リストパネルを表示します...';

        if (!interaction.replied && !interaction.deferred) {
            // まだ ACK されていない場合は reply
            await interaction.reply({ content: replyContent, ephemeral: true });
        } else {
            // すでに ACK 済みなら update / followUp を利用
            await interaction.followUp({ content: replyContent, ephemeral: true });
        }

        // --- 必要ならパネルEmbedの構築 ---
        // const embed = buildRideListEmbed();
        // await interaction.editReply({ embeds: [embed] });

        console.log('[handler] rideList handled:', interaction.user.id);

    } catch (err) {
        console.error('[handlerMap execute error]', {
            customId: interaction.customId,
            error: err.message,
        });
    }
};
