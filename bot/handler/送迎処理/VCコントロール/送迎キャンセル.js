const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 送迎キャンセルボタンハンドラー
 * VCコントロールパネルの「送迎キャンセル」ボタンから呼び出される
 */
module.exports = async function handleRideCancel(interaction, rideId) {
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

        // ドライバーのみキャンセル可能
        if (interaction.user.id !== dispatchData.driverId) {
            return interaction.followUp({ content: '⚠️ 送迎者のみがキャンセルできます。', ephemeral: true });
        }

        // Active Dispatch を削除
        await store.deleteFile(activePath).catch(() => null);

        // 相乗り募集メッセージを削除
        if (dispatchData.carpoolMessageId) {
            const { loadConfig } = require('../../utils/設定/設定マネージャ');
            const config = await loadConfig(guildId);
            if (config.channels?.carpool) {
                const carpoolChannel = guild.channels.cache.get(config.channels.carpool);
                if (carpoolChannel) {
                    await carpoolChannel.messages.delete(dispatchData.carpoolMessageId).catch(() => null);
                }
            }
        }

        // VCチャンネルを削除
        if (dispatchData.vcId) {
            const vcChannel = guild.channels.cache.get(dispatchData.vcId);
            if (vcChannel) {
                await vcChannel.delete('送迎キャンセル').catch(() => null);
            }
        }

        // 利用中一覧から削除
        try {
            const userInUsePath = paths.userInUseListJson(guildId);
            const usersInUse = await store.readJson(userInUsePath, []).catch(() => []);

            // 削除対象IDリスト
            const idsToRemove = [dispatchData.userId];
            if (dispatchData.carpoolUsers) {
                dispatchData.carpoolUsers.forEach(u => idsToRemove.push(u.userId));
            }

            const updatedUsers = usersInUse.filter(id => !idsToRemove.includes(id));
            await store.writeJson(userInUsePath, updatedUsers);
        } catch (err) {
            console.error('利用中一覧更新エラー (キャンセル時):', err);
        }

        // 利用者にDM通知
        try {
            const userMember = await guild.members.fetch(dispatchData.userId).catch(() => null);
            if (userMember) {
                await userMember.send({
                    content: `⚠️ 送迎がキャンセルされました。\n送迎者: <@${dispatchData.driverId}>`
                });
            }
        } catch (e) {
            console.log('利用者へのキャンセル通知失敗', e);
        }

        await interaction.followUp({ content: '✅ 送迎をキャンセルしました。', ephemeral: true });
    } catch (error) {
        console.error('送迎キャンセルエラー:', error);
        await interaction.followUp({ content: '⚠️ エラーが発生しました。', ephemeral: true }).catch(() => null);
    }
};
