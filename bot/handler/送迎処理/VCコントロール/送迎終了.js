const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { loadDriver } = require('../../utils/driversStore');

/**
 * 送迎終了ボタンハンドラー
 * VCコントロールパネルの「送迎終了」ボタンから呼び出される
 */
module.exports = async function handleRideComplete(interaction, rideId) {
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
            if (dispatchData.driverEndTime) return interaction.followUp({ content: '⚠️ 既に終了済みです。', ephemeral: true });
            dispatchData.driverEndTime = timeStr;
            await interaction.channel.send(`※送迎終了：送迎者 <@${interaction.user.id}>`);
        } else {
            if (dispatchData.userEndTime) return interaction.followUp({ content: '⚠️ 既に終了済みです。', ephemeral: true });
            dispatchData.userEndTime = timeStr;
            await interaction.channel.send(`※送迎終了：利用者 <@${interaction.user.id}>`);
        }

        // 両方が終了を押したか確認
        const isFinished = dispatchData.driverEndTime && dispatchData.userEndTime;

        if (!isFinished) {
            // 片方のみの場合はパネルの時刻のみ更新して保存
            await store.writeJson(activePath, dispatchData);

            const { EmbedBuilder } = require('discord.js');
            const currentEmbed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(currentEmbed)
                .setDescription(
                    `${currentEmbed.description.split('\n')[0]}\n` +
                    `送迎者：送迎開始時間：${dispatchData.driverStartTime || '未'} ｜ 送迎終了時間：${dispatchData.driverEndTime || '未'}\n` +
                    `利用者：送迎開始時間：${dispatchData.userStartTime || '未'} ｜ 送迎終了時間：${dispatchData.userEndTime || '未'}`
                );

            return await interaction.editReply({ embeds: [newEmbed] });
        }

        // --- 両方が押した場合の最終終了処理 ---

        // 送迎終了時刻を記録
        dispatchData.completedAt = now.toISOString();
        dispatchData.status = 'completed';

        // ドライバーの送迎件数を更新
        const driverData = await loadDriver(guildId, dispatchData.driverId);
        if (driverData) {
            driverData.rideCount = (driverData.rideCount || 0) + 1;
            const driverPath = paths.driverProfileJson(guildId, dispatchData.driverId);
            await store.writeJson(driverPath, driverData);
        }

        // Active Dispatch を削除
        await store.deleteFile(activePath).catch(() => null);

        // 送迎履歴の保存 (3箇所)
        try {
            const y = now.getFullYear();
            const m = now.getMonth() + 1;
            const d = now.getDate();

            // 1. 全体履歴
            const globalPath = paths.globalRideHistoryJson(guildId, y, m, d);
            const globalHistory = await store.readJson(globalPath).catch(() => []);
            globalHistory.push(dispatchData);
            await store.writeJson(globalPath, globalHistory);

            // 2. 送迎者別履歴
            const driverHistoryPath = paths.driverRideHistoryJson(guildId, dispatchData.driverId, y, m, d);
            const driverHistory = await store.readJson(driverHistoryPath).catch(() => []);
            driverHistory.push(dispatchData);
            await store.writeJson(driverHistoryPath, driverHistory);

            // 3. 利用者別履歴
            const userHistoryPath = paths.userRideHistoryJson(guildId, dispatchData.userId, y, m, d);
            const userHistory = await store.readJson(userHistoryPath).catch(() => []);
            userHistory.push(dispatchData);
            await store.writeJson(userHistoryPath, userHistory);
        } catch (err) {
            console.error('送迎履歴保存エラー:', err);
        }

        // 利用中一覧から削除
        try {
            const userInUsePath = paths.userInUseListJson(guildId);
            const usersInUse = await store.readJson(userInUsePath, []).catch(() => []);

            // 削除対象IDリストを作成 (メイン利用者 + 相乗り利用者)
            const idsToRemove = [dispatchData.userId];
            if (dispatchData.carpoolUsers) {
                dispatchData.carpoolUsers.forEach(u => idsToRemove.push(u.userId));
            }

            const updatedUsers = usersInUse.filter(id => !idsToRemove.includes(id));
            await store.writeJson(userInUsePath, updatedUsers);
        } catch (err) {
            console.error('利用中一覧更新エラー:', err);
        }

        // 相入り募集メッセージを削除
        if (dispatchData.carpoolMessageId) {
            const { loadConfig } = require('../../utils/設定/設定マネージャ');
            const config = await loadConfig(guildId);
            const carpoolChId = config.channels?.rideShare;
            if (carpoolChId) {
                const carpoolChannel = guild.channels.cache.get(carpoolChId);
                if (carpoolChannel) {
                    await carpoolChannel.messages.delete(dispatchData.carpoolMessageId).catch(() => null);
                }
            }
        }

        // VCチャンネル名を更新してから削除
        if (dispatchData.vcId) {
            const vcChannel = guild.channels.cache.get(dispatchData.vcId);
            if (vcChannel) {
                // 終了時刻を取得
                const endHours = String(now.getHours()).padStart(2, '0');
                const endMinutes = String(now.getMinutes()).padStart(2, '0');
                const endTimeStr = `${endHours}${endMinutes}`;

                // 現在のチャンネル名を取得し、終了時刻を追加
                const currentName = vcChannel.name;
                const updatedName = currentName.replace(/-【/, `-${endTimeStr}【`);

                // チャンネル名を更新
                await vcChannel.setName(updatedName).catch(() => null);

                // 少し待ってから削除
                await new Promise(resolve => setTimeout(resolve, 1000));

                await vcChannel.delete('送迎終了').catch(() => null);
            }
        }

        // --- ログ保持期間の設定 ---
        const { updateVcState } = require('../../../utils/vcStateStore');
        const { formatDateShort } = require('../../../utils/共通/日付フォーマット');
        const DAY = 1000 * 60 * 60 * 24;
        const expiresAt = new Date(now.getTime() + DAY * 7);

        if (dispatchData.vcId) {
            const vcStateData = await updateVcState(guildId, dispatchData.vcId, {
                endedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString()
            });

            if (vcStateData && vcStateData.logThreadId) {
                const thread = await guild.channels.fetch(vcStateData.logThreadId).catch(() => null);
                if (thread) {
                    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

                    const adminEmbed = new EmbedBuilder()
                        .setTitle('📁 送迎ログ保存設定')
                        .setDescription(
                            'この送迎のログは **7日間** 保存されます。\n' +
                            `削除予定：${formatDateShort(expiresAt)}\n\n` +
                            '必要な場合は「保存期間延長」ボタンを押して無期限保存に変更できます。'
                        )
                        .setColor(0x95a5a6)
                        .setTimestamp();

                    const adminButtons = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('ride:extend')
                                .setLabel('保存期間延長')
                                .setStyle(ButtonStyle.Secondary)
                                .setEmoji('⏳'),
                            new ButtonBuilder()
                                .setCustomId('ride:delete')
                                .setLabel('即時削除 (管理者)')
                                .setStyle(ButtonStyle.Danger)
                                .setEmoji('🗑️')
                        );

                    await thread.send({ embeds: [adminEmbed], components: [adminButtons] }).catch(console.error);
                }
            }
        }

        // 利用者と相乗り利用者にDM通知
        try {
            const userMember = await guild.members.fetch(dispatchData.userId).catch(() => null);
            if (userMember) {
                await userMember.send({
                    content: `✅ 送迎が完了しました。ご利用ありがとうございました！\n送迎者: <@${dispatchData.driverId}>`
                });
            }

            if (dispatchData.carpoolUsers && dispatchData.carpoolUsers.length > 0) {
                for (const carpoolUser of dispatchData.carpoolUsers) {
                    const carpoolMember = await guild.members.fetch(carpoolUser.userId).catch(() => null);
                    if (carpoolMember) {
                        await carpoolMember.send({
                            content: `✅ 送迎が完了しました。ご利用ありがとうございました！\n送迎者: <@${dispatchData.driverId}>`
                        }).catch(() => null);
                    }
                }
            }
        } catch (e) {
            console.log('利用者への完了通知失敗', e);
        }

        await interaction.followUp({ content: '✅ 送迎を終了しました。お疲れ様でした！', ephemeral: true });
    } catch (error) {
        console.error('送迎終了エラー:', error);
        await interaction.followUp({ content: '⚠️ エラーが発生しました。', ephemeral: true }).catch(() => null);
    }
};
