const { EmbedBuilder } = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { formatDateShort } = require('../../utils/共通/日付フォーマット');

/**
 * 送迎開始ボタンハンドラー
 * VCコントロールパネルの「送迎開始」ボタンから呼び出される
 */
module.exports = async function handleRideStart(interaction, rideId) {
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

        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const isDriver = interaction.user.id === dispatchData.driverId;
        const isUser = interaction.user.id === dispatchData.userId;

        if (!isDriver && !isUser) {
            return interaction.followUp({ content: '⚠️ 送迎者または利用者のみが操作できます。', ephemeral: true });
        }

        // 時刻を記録
        if (isDriver) {
            if (dispatchData.driverStartTime) return interaction.followUp({ content: '⚠️ 既に開始済みです。', ephemeral: true });
            dispatchData.driverStartTime = timeStr;
            await interaction.channel.send(`※送迎開始：送迎者 <@${interaction.user.id}>`);
        } else {
            if (dispatchData.userStartTime) return interaction.followUp({ content: '⚠️ 既に開始済みです。', ephemeral: true });
            dispatchData.userStartTime = timeStr;
            await interaction.channel.send(`※送迎開始：利用者 <@${interaction.user.id}>`);
        }

        // 最初の開始時刻を rideStartedAt に保存（互換性のため）
        if (!dispatchData.rideStartedAt) {
            dispatchData.rideStartedAt = now.toISOString();
            dispatchData.status = 'in-progress';
        }

        // データを保存
        await store.writeJson(activePath, dispatchData);

        // パネルを更新
        const currentEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(currentEmbed)
            .setDescription(
                `${currentEmbed.description.split('\n')[0]}\n` +
                `送迎者：送迎開始時間：${dispatchData.driverStartTime || '未'} ｜ 送迎終了時間：${dispatchData.driverEndTime || '未'}\n` +
                `利用者：送迎開始時間：${dispatchData.userStartTime || '未'} ｜ 送迎終了時間：${dispatchData.userEndTime || '未'}`
            );

        await interaction.editReply({ embeds: [newEmbed] });
    } catch (error) {
        console.error('送迎開始エラー:', error);
        await interaction.followUp({ content: '⚠️ エラーが発生しました。', ephemeral: true }).catch(() => null);
    }
};
