const handleApproach = require('./向かっています');
const handleStart = require('./送迎開始');
const handleEnd = require('./送迎終了');
const { updateVcState } = require('../../utils/vcStateStore');
const { EmbedBuilder } = require('discord.js');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * VC操作ルーター
 * カスタムID形式: vc:btn:action:rideId
 */
module.exports = async function (interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[2];
    const rideId = parts[3]; // might be undefined for 'extend'

    if (action === 'approach') {
        return handleApproach(interaction, rideId);
    }
    if (action === 'start') {
        return handleStart(interaction, rideId);
    }
    if (action === 'end') {
        return handleEnd(interaction, rideId);
    }

    if (action === 'extend') {
        // 削除延長 (カスタムID: vc:btn:extend)
        // rideIdは含まれていない可能性が高い (メッセージ依存)
        // VCステートから情報を引く
        const channelId = interaction.channelId;
        const guildId = interaction.guildId;

        try {
            await interaction.deferUpdate();

            const state = await require('../../utils/vcStateStore').loadVcState(guildId);
            const vcData = state[channelId];

            if (!vcData) {
                return interaction.followUp({ content: '⚠️ このチャンネルのデータが見つかりません。', ephemeral: true });
            }

            // 更新: expiresAt を null (無期限) に
            await updateVcState(guildId, channelId, { expiresAt: null });

            // メッセージ更新 (ボタン無効化など)
            const currentEmbed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(currentEmbed)
                .setDescription(currentEmbed.description + '\n\n✅ **保存期間を延長しました（無期限保存）**')
                .setColor(0x2ecc71); // Green

            await interaction.editReply({ embeds: [newEmbed], components: [] });

            // 管理者ログ送信
            const { loadConfig } = require('../../utils/設定/設定マネージャ');
            const config = await loadConfig(guildId);
            const logThreadId = config.channels?.adminLogThread;
            if (logThreadId) {
                const thread = await interaction.guild.channels.fetch(logThreadId).catch(() => null);
                if (thread) {
                    await thread.send({
                        content: `⏳ **保存期間延長**\n実行者: <@${interaction.user.id}>\nチャンネル: <#${channelId}>`
                    });
                }
            }

        } catch (error) {
            console.error('削除延長エラー:', error);
            await interaction.followUp({ content: '⚠️ エラーが発生しました。', ephemeral: true }).catch(() => null);
        }
        return;
    }
};
