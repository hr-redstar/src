// handler/相乗り/承認.js
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { updateCarpoolMessage } = require('../../utils/配車/相乗りマネージャ.js'); // updateCarpoolはpostRecruitment内で処理するかも要検討だが一旦作る
const { postCarpoolRecruitment } = require('../../utils/配車/相乗りマネージャ.js');
const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
const {
    onDutyDriversJson,
    globalRideHistoryJson,
} = require('../../utils/ストレージ/ストレージパス');
const { loadUser } = require('../../utils/usersStore');
const { RideStatus } = require('../../utils/constants');

const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = {
    execute: async function (interaction, client, parsed) {
        // carpool|approve|rid={rideId}&uid={userId}&cnt={count}
        // v2.9.2: shortened keys carpool|approve|r={rideId}&u={userId}
        const rideId = parsed?.params?.r || parsed?.params?.rid;
        const userId = parsed?.params?.u || parsed?.params?.uid; // 相乗り希望者

        // rideId が timestamp_userId_guildId 形式ならそこから抽出
        const guildIdFromRideId = rideId?.split('_')?.[2];
        const guildId = interaction.guildId || parsed?.params?.gid || guildIdFromRideId;
        const guild = interaction.guild || (guildId ? await client.guilds.fetch(guildId).catch(() => null) : null);

        if (!guild) return interaction.editReply('❌ サーバー情報が見つかりませんでした。');

        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO, // メッセージ更新 (deferReplyされるためeditReplyを使用)
            async run(interaction) {
                const activePath = `${paths.activeDispatchDir(guild.id)}/${rideId}.json`;
                const rideData = await store.readJson(activePath).catch(() => null);

                if (!rideData) return interaction.editReply('❌ 送迎データが見つかりません。');

                // 保留中のリクエストからデータを取得 (ID文字数制限対策の読み込み)
                const request = rideData.pendingCarpoolRequests?.[userId];
                if (!request) return interaction.editReply('⚠️ 相乗りリクエストの有効期限が切れたか、既に行き先が変更されています。');

                const count = request.count || 1;
                const segment = parseInt(parsed?.params?.seg) || 1;
                const carpoolLoc = request.location || '不明';

                // --- NEW: 定員超過チェック (v2.9.2) ---
                const { calculateRemainingCapacity } = require('../../utils/配車/相乗りマネージャ');
                const { buildPanelEmbed } = require('../../utils/embed/panelEmbedBuilder');
                const remaining = await calculateRemainingCapacity(guild.id, rideData);

                if (remaining < count) {
                    const failEmbed = buildPanelEmbed({
                        title: '⚠️ 定員オーバー',
                        description: `この送迎車の空き枠（${remaining}名）が不足しているため、承認できません（リクエスト：${count}名）。`,
                        color: 0xe74c3c,
                        client
                    });
                    return interaction.editReply({ embeds: [failEmbed], components: [] });
                }

                // ルート更新ロジック (A -> B -> C -> D)
                const A = rideData.driverPlace || '現在地';
                const B = rideData.pickup || '方面';
                const C = rideData.target || '目的地';
                const X = carpoolLoc;

                let newRoute = '';
                if (segment === 1) newRoute = `【${A}】→【${X}】→【${B}】→【${C}】`;
                else if (segment === 2) newRoute = `【${A}】→【${B}】→【${X}】→【${C}】`;
                else newRoute = `【${A}】→【${B}】→【${C}】→【${X}】`;

                rideData.route = newRoute;
                if (segment === 3) rideData.target = X; // 目的地が更新された場合

                // 相取りユーザー追加
                if (!rideData.carpoolUsers) rideData.carpoolUsers = [];
                if (rideData.carpoolUsers.some((u) => u.userId === userId)) {
                    return interaction.followUp({ content: '⚠️ 既に承認済みです。', flags: 64 });
                }

                rideData.carpoolUsers.push({
                    userId,
                    count,
                    location: X,
                    segment,
                    approvedAt: new Date().toISOString(),
                });

                // 保留中のリクエストを削除 (クリーンアップ)
                delete rideData.pendingCarpoolRequests[userId];

                // 運営者ログの同期 (v1.7.0: 相乗り追加による更新)
                const { updateRideOperatorLog } = require('../../utils/ログ/rideLogManager');
                await updateRideOperatorLog({
                    guild: interaction.guild,
                    rideId: rideId,
                    status: rideData.status === RideStatus.STARTED ? RideStatus.STARTED : RideStatus.MATCHED,
                    data: {
                        area: newRoute,
                    }
                }).catch(() => null);

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
                    const embed = buildPanelEmbed({
                        title: '✅ 相乗り承認',
                        description: 'ドライバーがあなたの相乗りリクエストを承認しました！\n専用のプライベートVCに参加して、合流の調整を行ってください。',
                        color: 0x2ecc71,
                        client: client,
                        fields: [{
                            name: '🔗 VCリンク',
                            value: rideData.vcId
                                ? `[こちらから参加](https://discord.com/channels/${guild.id}/${rideData.vcId})`
                                : 'リンクを発行できませんでした',
                        }]
                    });
                    await requester.send({ embeds: [embed] }).catch(() => null);
                }

                // 運営者ログ送信 (Task 18 & 22)
                const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
                const { loadConfig } = require('../../utils/設定/設定マネージャ');
                const config = await loadConfig(guild.id);

                let msgLink = '';
                if (rideData.carpoolMessageId && config.rideShareChannel) {
                    msgLink = `[募集メッセージを表示](https://discord.com/channels/${guild.id}/${config.rideShareChannel}/${rideData.carpoolMessageId})`;
                }

                const logEmbed = buildPanelEmbed({
                    title: '🤝 相乗り成立',
                    description: '新しい相乗りマッチングが成立しました。',
                    color: 0x2ecc71,
                    client,
                    fields: [
                        { name: '🚗 ドライバー', value: `<@${rideData.driverId}>`, inline: true },
                        { name: '👤 利用者', value: `<@${userId}>`, inline: true },
                        { name: '👥 人数', value: `${count}名`, inline: true },
                        { name: '🔗 リンク', value: msgLink || '不明', inline: false }
                    ]
                });

                await postOperatorLog({
                    guild,
                    embeds: [logEmbed],
                }).catch(() => null);

                // グローバルログ送信
                const { postGlobalLog } = require('../../utils/ログ/グローバルログ');
                await postGlobalLog({
                    guild,
                    embeds: [logEmbed],
                }).catch(() => null);

                // 統計カウント (v2.9.2)
                const { incrementStat } = require('../../utils/ストレージ/統計ストア');
                await incrementStat(guild.id, 'carpool_matched', 1).catch(() => null);

                // ボタン無効化orメッセージ変更
                const successEmbed = buildPanelEmbed({
                    title: '✅ 承認済み',
                    description: '相乗りリクエストを承認しました。\nルートが自動的に更新されています。',
                    color: 0x2ecc71,
                    client
                });

                await interaction.editReply({ embeds: [successEmbed], components: [] });
            },
        });
    },
};
