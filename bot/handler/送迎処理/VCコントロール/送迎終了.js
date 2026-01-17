const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { loadDriver } = require('../../utils/driversStore');
const { sendRatingDM } = require('../../配車システム/評価システム');
const { updateVcState } = require('../../utils/vcStateStore');
const { formatDateShort } = require('../../utils/共通/日付フォーマット');

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

        // データを保存 (statusはまだ active のまま、完全に終わったら削除される)
        if (isFinished) {
            dispatchData.completedAt = now.toISOString();
            dispatchData.status = 'completed';
        }
        await store.writeJson(activePath, dispatchData);

        // Embed更新 (Fields)
        const currentEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(currentEmbed);
        const fields = newEmbed.data.fields || [];

        if (isDriver) {
            if (fields[0]) fields[0].value = fields[0].value.replace(/送迎終了時間：--:--/, `送迎終了時間：${timeStr}`);
        } else {
            if (fields[1]) fields[1].value = fields[1].value.replace(/送迎終了時間：--:--/, `送迎終了時間：${timeStr}`);
        }

        if (isFinished) {
            // タイトル更新: "送迎終了" を追加したりする？ 仕様には明確なEmbed更新指示はないが
            // "embed更新 タイトル：VC名 を" -> "VC名：...~終了時間..." に更新する指示がある
            // ここではEmbed内のタイトルも更新しておく
            // VC名更新ロジックは後述
            newEmbed.setTitle(newEmbed.data.title.replace(/--:--$/, timeStr)); // タイトルがVC名と同じ前提
            newEmbed.setDescription(newEmbed.data.description.replace('**向かっています**', '✅ **送迎終了しました**\n**向かっています**'));
            newEmbed.setColor(0x95a5a6); // Gray
        }
        newEmbed.setFields(fields);

        // ボタン更新
        const currentComponents = interaction.message.components;
        let newComponents = currentComponents.map(row => {
            const newRow = new ActionRowBuilder();
            row.components.forEach(component => {
                const btn = ButtonBuilder.from(component);
                if (btn.data.custom_id === interaction.customId) {
                    let label = btn.data.label;
                    if (isDriver && !label.includes('送迎者済')) label += '(送迎者済)';
                    if (isUser && !label.includes('利用者済')) label += '(利用者済)';
                    btn.setLabel(label);

                    if (label.includes('送迎者済') && label.includes('利用者済')) {
                        btn.setDisabled(true);
                        btn.setStyle(ButtonStyle.Secondary);
                    }
                }
                // もし完了したら全ボタン無効化するか？ -> Start/Approachは既に無効化されているはずだが
                // 安全のため完了時は全て無効化しても良いが、個別制御しているのでそのまま
                newRow.addComponents(btn);
            });
            return newRow;
        });

        if (isFinished) {
            // 完了時は全ボタン無効化
            newComponents = newComponents.map(row => {
                const newRow = new ActionRowBuilder();
                row.components.forEach(component => {
                    const btn = ButtonBuilder.from(component);
                    btn.setDisabled(true);
                    btn.setStyle(ButtonStyle.Secondary);
                    newRow.addComponents(btn);
                });
                return newRow;
            });
        }

        await interaction.editReply({ embeds: [newEmbed], components: newComponents });

        if (!isFinished) return;

        // --- 両方が押した場合の最終終了処理 ---

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

        // VCチャンネル名を更新
        const timeHHMM = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
        if (interaction.channel) {
            // 現在の名前: MM/DD HH:mm~--:--...
            // 更新後: MM/DD HH:mm~HH:mm...
            // replace(/~--:--/, `~${timeStr}`) としたいが、VC名は記号が使えない場合もあるので置換ロジックに注意
            // createPrivateVcでの生成: `${mm}/${dd} ${matchTime}~--:--`
            // matchTimeは HH:mm.
            // 終了時間は HHmm (コロンなし) のフォーマットにする指示があったような...
            // "送迎終了時間 は未終了時は空欄" -> これはEmbedの話？
            // "VC名：月日 マッチング時間~送迎終了時間..." -> コロンありかな
            // 元コードの送迎終了処理では `${endHours}${endMinutes}` だった。
            // 今回の createPrivateVc では `${matchTime}~--:--` (HH:mm).
            // ここでは HH:mm に合わせるのが自然。

            const currentName = interaction.channel.name;
            const updatedName = currentName.replace(/~--:--/, `~${timeStr}`); // HH:mm
            await interaction.channel.setName(updatedName).catch(() => null);
        }

        // --- 終了メッセージ送信 (削除延長ボタン付き) ---
        const completionEmbed = new EmbedBuilder()
            .setTitle('送迎終了しました')
            .setDescription(
                '落とし物などのトラブルが無ければ、\n' +
                '1週間でこのvcチャンネルは削除されます。\n\n' +
                '※トラブルがあった場合は、\n' +
                '削除延長を押して下さい。'
            )
            .setColor(0xe74c3c); // Red

        const completionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('ride|extend') // rideId不要 (VC依存)
                .setLabel('削除延長')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.channel.send({ embeds: [completionEmbed], components: [completionRow] });

        // --- ログ保持期間の設定 (デフォルト7日後) ---
        const DAY = 1000 * 60 * 60 * 24;
        const expiresAt = new Date(now.getTime() + DAY * 7);

        await updateVcState(guildId, interaction.channel.id, {
            endedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString()
        });

        // --- 口コミ評価DM送信 ---
        await sendRatingDM(guild, dispatchData);

    } catch (error) {
        console.error('送迎終了エラー:', error);
        await interaction.followUp({ content: '⚠️ エラーが発生しました。', ephemeral: true }).catch(() => null);
    }
};
