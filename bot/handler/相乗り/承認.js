// handler/相乗り/承認.js
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { updateCarpoolMessage } = require('../../utils/配車/相乗りマネージャ.js'); // updateCarpoolはpostRecruitment内で処理するかも要検討だが一旦作る
const { postCarpoolRecruitment } = require('../../utils/配車/相乗りマネージャ.js');
const { postGlobalLog } = require('../../utils/ログ/グローバルログ');
const {
    onDutyDriversJson,
    globalRideHistoryJson,
} = require('../../utils/ストレージ/ストレージパス');
const { loadUser } = require('../../utils/usersStore');

const interactionTemplate = require('../共通/interactionTemplate');
const { ACK } = interactionTemplate;

module.exports = {
    execute: async function (interaction, parsed) {
        // carpool|approve|rid={rideId}&uid={userId}&cnt={count}
        const rideId = parsed?.params?.rid;
        const userId = parsed?.params?.uid; // 相乗り希望者
        const count = parseInt(parsed?.params?.cnt) || 1;
        const guild = interaction.guild;

        return interactionTemplate(interaction, {
            ack: ACK.UPDATE, // メッセージ更新
            async run(interaction) {
                const rideId = parsed?.params?.rid;
                const userId = parsed?.params?.uid;
                const count = parseInt(parsed?.params?.cnt) || 1;
                const segment = parseInt(parsed?.params?.seg) || 1;
                const carpoolLoc = parsed?.params?.loc || '不明';

                const activePath = `${paths.activeDispatchDir(guild.id)}/${rideId}.json`;
                const rideData = await store.readJson(activePath).catch(() => null);

                if (!rideData) return interaction.editReply('❌ データが見つかりません。');

                // ルート更新ロジック (A -> B -> C -> D)
                const A = rideData.driverPlace || '現在地';
                const B = rideData.mark || '目印';
                const C = rideData.destination || '最終目的地';
                const X = carpoolLoc;

                let newRoute = '';
                if (segment === 1) newRoute = `【${A}】→【${X}】→【${B}】→【${C}】`;
                else if (segment === 2) newRoute = `【${A}】→【${B}】→【${X}】→【${C}】`;
                else newRoute = `【${A}】→【${B}】→【${C}】→【${X}】`;

                rideData.route = newRoute;
                if (segment === 3) rideData.destination = X; // 最終目的地が更新された場合

                // 相取りユーザー追加
                if (!rideData.carpoolUsers) rideData.carpoolUsers = [];
                if (rideData.carpoolUsers.some((u) => u.userId === userId)) {
                    return interaction.followUp({ content: '⚠️ 既に承認済みです。', ephemeral: true });
                }

                rideData.carpoolUsers.push({
                    userId,
                    count,
                    location: X,
                    segment,
                    approvedAt: new Date().toISOString(),
                });

                // 運営者ログの同期 (更新: 青 - 相乗り追加更新)
                const { syncOperationLog } = require('../../utils/ログ/operationLogHelper');
                const opLogId = await syncOperationLog(guild, rideData);
                if (opLogId) {
                    rideData.operationLogMessageId = opLogId;
                }

                await store.writeJson(activePath, rideData);

                // プライベートVCの埋め込み更新
                const vcChannel = await guild.channels.fetch(rideData.vcId).catch(() => null);
                if (vcChannel) {
                    const msgId = rideData.vcMessageId;
                    if (msgId) {
                        const vcMsg = await vcChannel.messages.fetch(msgId).catch(() => null);
                        if (vcMsg) {
                            const { buildVcControlEmbed } = require('../../utils/配車/vcControlEmbedBuilder');
                            const newEmbed = buildVcControlEmbed(rideData);
                            await vcMsg.edit({ embeds: [newEmbed] });
                        }
                    }
                    await vcChannel.send(`➕ <@${userId}> 様の相乗りが承認されました！\nルートが更新されました：${newRoute}`);

                    // VC名の更新 (ルートが変わったため)
                    // 仕様: 月日 マッチング時間~送迎終了時間【送迎者現在地】→【目印】→【目的地】
                    // 終了時間は --:-- のまま
                    const now = new Date();
                    const month = now.getMonth() + 1;
                    const day = now.getDate();
                    const dateStr = `${month}/${day}`;
                    const timeStr = rideData.matchTime || '--:--';
                    const newChannelName = `${dateStr} ${timeStr}~--:-- ${newRoute}`;
                    await vcChannel.setName(newChannelName.substring(0, 100)).catch(() => null);
                }

                // 利用中一覧に追加
                try {
                    const userInUsePath = paths.userInUseListJson(guild.id);
                    const usersInUse = await store.readJson(userInUsePath, []).catch(() => []);
                    if (!usersInUse.includes(userId)) {
                        usersInUse.push(userId);
                        await store.writeJson(userInUsePath, usersInUse);
                    }
                } catch (err) {
                    console.error('利用中一覧更新エラー (承認時):', err);
                }

                // --- NEW: 送迎中一覧 & 送迎履歴への反映 ---
                const carpoolUser = await loadUser(guild.id, userId);
                const carpoolEntry = {
                    matchTime: new Date().toISOString(),
                    userId: userId,
                    userName: carpoolUser?.name || '不明', // carpoolUser might be null if not loaded, fallback
                    location: carpoolLoc, // Request location
                    pickupTime: null, // 乗車時間は現時点ではnull (or current time?) -> ユーザー要望では「乗車時間」あり。マッチング時=乗車時なら現在時刻。
                };
                carpoolEntry.pickupTime = carpoolEntry.matchTime;

                // 1. 送迎中一覧 (Active List) 更新
                try {
                    const onDutyPath = onDutyDriversJson(guild.id);
                    const onDutyList = await store.readJson(onDutyPath).catch(() => ({}));
                    if (onDutyList && onDutyList[rideData.driverId]) {
                        if (!onDutyList[rideData.driverId].carpool) onDutyList[rideData.driverId].carpool = [];
                        onDutyList[rideData.driverId].carpool.push(carpoolEntry);
                        await store.writeJson(onDutyPath, onDutyList);
                    }
                } catch (e) {
                    console.error('送迎中一覧更新エラー(相乗り)', e);
                }

                // 2. 送迎履歴 (Global History) 更新
                try {
                    // マッチング時のタイムスタンプからファイル特定
                    const rideDate = new Date(rideData.timestamp);
                    const y = rideDate.getFullYear();
                    const m = rideDate.getMonth() + 1;
                    const d = rideDate.getDate();
                    const historyPath = globalRideHistoryJson(guild.id, y, m, d);

                    const historyList = await store.readJson(historyPath).catch(() => ({}));
                    if (historyList) {
                        // HistoryIdをどう探すか？ -> driverId と timestamp から推測 or driverIdで検索して startTime match?
                        // Simple approach: find entry with same driverId and startTime ~= rideData.timestamp
                        // historyList values
                        const entries = Object.values(historyList);
                        const targetEntry = entries.find((e) => {
                            // rideData.timestamp (number) vs e.matchTime (ISO string)
                            // diff < 5000ms ? or just match rideId if we stored it?
                            // In StartRide, I stored `rideEntry` which has `matchTime`.
                            // Let's use driverId. If multiple active? Driver can only be in one active.
                            return e.driverId === rideData.driverId && !e.endTime;
                        });

                        if (targetEntry) {
                            if (!targetEntry.carpool) targetEntry.carpool = [];
                            targetEntry.carpool.push(carpoolEntry);
                            // id = targetEntry.historyId;
                            // historyList[id] = targetEntry;
                            // Since targetEntry is a reference to the object inside historyList (if Object.values returns refs? No, Object.values returns array of values. BUT if I modify the object, I need to put it back into the MAP if I don't have the key.)
                            // I need the KEY.
                            const targetKey = Object.keys(historyList).find(
                                (key) => historyList[key] === targetEntry
                            );
                            if (targetKey) {
                                historyList[targetKey] = targetEntry;
                                await store.writeJson(historyPath, historyList);
                            }
                        }
                    }
                } catch (e) {
                    console.error('送迎履歴更新エラー(相乗り)', e);
                }
                // ------------------------------------------

                // プライベートVCへの追加
                if (rideData.vcId) {
                    const channel = guild.channels.cache.get(rideData.vcId);
                    if (channel) {
                        try {
                            await channel.permissionOverwrites.edit(userId, {
                                ViewChannel: true,
                                Connect: true,
                                Speak: true,
                            });
                        } catch (e) {
                            console.error('VC権限追加失敗', e);
                        }
                    }
                }

                // 相乗りメッセージ更新 (人数減)
                await postCarpoolRecruitment(guild, rideData, interaction.client).catch(() => null);

                // ユーザーへ通知
                const requester = await guild.members.fetch(userId).catch(() => null);
                if (requester) {
                    const embed = new EmbedBuilder()
                        .setTitle('✅ 相乗り承認')
                        .setDescription(
                            `ドライバーが相乗りリクエストを承認しました！\nプライベートVCに参加して合流してください。`
                        )
                        .addFields({
                            name: 'VCリンク',
                            value: rideData.vcId
                                ? `[こちらから参加](https://discord.com/channels/${guild.id}/${rideData.vcId})`
                                : 'リンク不明',
                        })
                        .setColor(0x00ff00);
                    await requester.send({ embeds: [embed] }).catch(() => null);
                }

                // 運営者ログ送信 (Task 18 & 22)
                // 相乗り成立ログは運営者ログに送る
                const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
                const { loadConfig } = require('../../utils/設定/設定マネージャ'); // config読み込み追加
                const config = await loadConfig(guild.id);

                let msgLink = '';
                if (rideData.carpoolMessageId && config.channels?.carpool) {
                    msgLink = `[募集メッセージ](https://discord.com/channels/${guild.id}/${config.channels.carpool}/${rideData.carpoolMessageId})`;
                }

                const logEmbed = new EmbedBuilder()
                    .setTitle('🤝 相乗り成立')
                    .setDescription(`以下の相乗りリクエストが承認されました。`)
                    .addFields(
                        { name: 'ドライバー', value: `<@${rideData.driverId}>`, inline: true },
                        { name: '相乗り利用者', value: `<@${userId}>`, inline: true },
                        { name: '人数', value: `${count}名`, inline: true },
                        { name: 'リンク', value: msgLink || '不明', inline: false }
                    )
                    .setColor(0x00ff00)
                    .setTimestamp();

                await postOperatorLog({
                    guild,
                    embeds: [logEmbed],
                }).catch(() => null);

                // グローバルログ送信
                await postGlobalLog({
                    guild,
                    embeds: [logEmbed],
                }).catch(() => null);

                // ボタン無効化orメッセージ変更
                const embed = EmbedBuilder.from(interaction.message.embeds[0]);
                embed.setTitle('✅ 承認済み');
                embed.setColor(0x00ff00);
                embed.setFooter({ text: '相乗りが成立しました' });

                await interaction.editReply({ embeds: [embed], components: [] });
            },
        });
    },
};
