const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // データ更新
        if (dispatchData.approachTime) return interaction.followUp({ content: '⚠️ 既に通知済みです。', ephemeral: true });
        dispatchData.approachTime = timeStr;
        await store.writeJson(activePath, dispatchData);

        // 通知メッセージを送信
        await interaction.channel.send({
            content: `※向かっています：<@${interaction.user.id}> (${timeStr})`
        });

        // Embed更新
        const currentEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(currentEmbed);

        // Description内の「**向かっています**：--:--」を置換
        let desc = newEmbed.data.description;
        desc = desc.replace(/\*\*向かっています\*\*：--:--/, `**向かっています**：${timeStr}`);
        newEmbed.setDescription(desc);

        // ボタン更新 (向かっていますボタンのみ無効化)
        const currentComponents = interaction.message.components;
        const newComponents = currentComponents.map(row => {
            const newRow = new ActionRowBuilder();
            row.components.forEach(component => {
                const btn = ButtonBuilder.from(component);
                if (btn.data.custom_id === interaction.customId) {
                    btn.setDisabled(true);
                }
                newRow.addComponents(btn);
            });
            return newRow;
        });

        await interaction.editReply({ embeds: [newEmbed], components: newComponents });

    } catch (error) {
        console.error('向かっていますエラー:', error);
        await interaction.followUp({ content: '⚠️ エラーが発生しました。', ephemeral: true }).catch(() => null);
    }
};
