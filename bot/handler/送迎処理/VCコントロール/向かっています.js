const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 「向かっています」ボタンハンドラー
 * 送迎者のみ実行可能
 */
module.exports = async function handleRideEnroute(interaction, rideId) {
    try {
        await interaction.deferUpdate();

        const guild = interaction.guild;
        const guildId = guild.id;

        // Active Dispatch データを読み込み
        const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
        const dispatchData = await store.readJson(activePath).catch(() => null);

        if (!dispatchData) {
            return interaction.followUp({ content: '⚠️ 送迎データが見つかりません。', ephemeral: true });
        }

        // 送迎者（ドライバー）のみ実行可能
        if (interaction.user.id !== dispatchData.driverId) {
            return interaction.followUp({ content: '⚠️ 送迎者のみが実行できます。', ephemeral: true });
        }

        // 通知メッセージを送信
        await interaction.channel.send({
            content: `※向かっています：<@${interaction.user.id}>`
        });

        // ボタンの応答メッセージ（任意：目立たせたくない場合は非表示でも良いが、ACKとして必要）
        // await interaction.followUp({ content: '✅ 「向かっています」を通知しました。', ephemeral: true });
    } catch (error) {
        console.error('向かっていますエラー:', error);
        await interaction.followUp({ content: '⚠️ エラーが発生しました。', ephemeral: true }).catch(() => null);
    }
};
