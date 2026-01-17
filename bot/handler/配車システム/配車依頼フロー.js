const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 配車依頼フロー（ボタンのみの対話型）
 */
module.exports = {
    execute: async function (interaction, parsed) {
        const step = parsed?.params?.sub || 'type';
        const type = parsed?.params?.type || '';
        const direction = parsed?.params?.dir || '';
        const count = parsed?.params?.cnt || '';

        return autoInteractionTemplate(interaction, {
            ack: (parsed?.params?.sub || 'type') === 'type' ? ACK.REPLY : ACK.AUTO,
            async run(interaction) {
                if (step === 'type') {
                    return showTypeSelection(interaction);
                }
                if (step === 'direction') {
                    return showDirectionSelection(interaction, type);
                }
                if (step === 'count') {
                    return showCountSelection(interaction, type, direction);
                }
                if (step === 'confirm') {
                    return showConfirmation(interaction, type, direction, count);
                }
                if (step === 'execute') {
                    return executeDispatch(interaction, type, direction, count);
                }
                if (step === 'depart') {
                    return handleDepart(interaction, parsed?.params?.did);
                }
                if (step === 'complete') {
                    return handleComplete(interaction, parsed?.params?.did);
                }
                if (step === 'carpool_join') {
                    return handleCarpoolJoin(interaction, parsed?.params?.rid);
                }
                if (step === 'carpool_modal') {
                    return handleCarpoolModal(interaction, parsed?.params?.rid);
                }
            }
        });
    }
};

/**
 * STEP 1: 種別選択 [キャスト] or [ゲスト]
 */
async function showTypeSelection(interaction) {
    const embed = new EmbedBuilder()
        .setTitle("🚕 配車依頼 - 種別選択")
        .setDescription("ご乗車される方の種別を選択してください。")
        .setColor(0x0099ff);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`dispatch|order|sub=direction&type=cast`).setLabel("キャスト").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`dispatch|order|sub=direction&type=guest`).setLabel("ゲスト(お客様)").setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * STEP 2: 方面選択
 */
async function showDirectionSelection(interaction, type) {
    const config = await loadConfig(interaction.guildId);
    const directions = config.directions || ["立川方面", "八王子市内", "相模原方面", "その他"];

    const embed = new EmbedBuilder()
        .setTitle("🚕 配車依頼 - 方面選択")
        .setDescription(`種別: **${type === 'cast' ? 'キャスト' : 'ゲスト'}**\n\n目的地（方面）を選択してください。`)
        .setColor(0x0099ff);

    // ボタンが多すぎる場合はセレクトメニューに切り替えるが、まずはボタンで実装
    const rows = [];
    let currentRow = new ActionRowBuilder();

    directions.forEach((dir, index) => {
        if (index > 0 && index % 5 === 0) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
        }
        currentRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`dispatch|order|sub=count&type=${type}&dir=${dir}`)
                .setLabel(dir)
                .setStyle(ButtonStyle.Success)
        );
    });
    rows.push(currentRow);

    // 戻るボタン
    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`dispatch|order|sub=type`).setLabel("← 戻る").setStyle(ButtonStyle.Danger)
    );
    rows.push(navRow);

    await interaction.editReply({ embeds: [embed], components: rows });
}

/**
 * STEP 3: 人数選択
 */
async function showCountSelection(interaction, type, direction) {
    const embed = new EmbedBuilder()
        .setTitle("🚕 配車依頼 - 人数選択")
        .setDescription(`種別: **${type === 'cast' ? 'キャスト' : 'ゲスト'}**\n方面: **${direction}**\n\n乗車人数を選択してください。`)
        .setColor(0x0099ff);

    const row = new ActionRowBuilder().addComponents(
        [1, 2, 3, 4, 5].map(n =>
            new ButtonBuilder().setCustomId(`dispatch|order|sub=confirm&type=${type}&dir=${direction}&cnt=${n}`).setLabel(`${n}人`).setStyle(ButtonStyle.Primary)
        )
    );

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`dispatch|order|sub=direction&type=${type}`).setLabel("← 戻る").setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [row, navRow] });
}

/**
 * STEP 4: 最終確認
 */
async function showConfirmation(interaction, type, direction, count) {
    const embed = new EmbedBuilder()
        .setTitle("🚕 配車依頼 - 最終確認")
        .setDescription(`以下の内容で配車を依頼します。よろしいですか？\n\n・種別: **${type === 'cast' ? 'キャスト' : 'ゲスト'}**\n・方面: **${direction}**\n・人数: **${count}人**`)
        .setColor(0xffff00);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`dispatch|order|sub=execute&type=${type}&dir=${direction}&cnt=${count}`).setLabel("配車を確定する").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`dispatch|order|sub=count&type=${type}&dir=${direction}`).setLabel("やり直す").setStyle(ButtonStyle.Danger)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * STEP 5: 実行（マッチングロジック呼び出し）
 */
async function executeDispatch(interaction, type, direction, count) {
    // ここでFIFO先頭ドライバーを取得し、マッチング処理を行う
    const { popNextDriver } = require('../../utils/配車/待機列マネージャ');
    const driver = await popNextDriver(interaction.guildId);

    if (!driver) {
        return interaction.editReply({
            content: "⚠️ 現在、待機中の送迎車がいません。しばらく経ってから再度お試しいただくか、担当者へ直接ご連絡ください。",
            embeds: [],
            components: []
        });
    }

    // マッチング成功
    const { startDispatch } = require('./配車開始');
    const dispatchId = await startDispatch({
        guild: interaction.guild,
        driver,
        passenger: interaction.user,
        type,
        direction,
        count
    });

    const embed = new EmbedBuilder()
        .setTitle("✅ 配車マッチング成功！")
        .setDescription(`<@${driver.userId}> さんが配車されました。\n専用の連絡チャンネルを作成しました。`)
        .addFields(
            { name: "種別", value: type === 'cast' ? 'キャスト' : 'ゲスト', inline: true },
            { name: "方面", value: direction, inline: true },
            { name: "人数", value: `${count}人`, inline: true }
        )
        .setColor(0x00ff00);

    await interaction.editReply({ embeds: [embed], components: [] });

    // 相乗り募集判定（キャストかつ特定条件）
    if (type === 'cast') {
        const { handleCarpoolRecruitment } = require('./相乗り処理');
        await handleCarpoolRecruitment(interaction.guild, interaction.user, direction, count, dispatchId);
    }
}

/**
 * 出発処理
 */
async function handleDepart(interaction, dispatchId) {
    const paths = require('../../utils/ストレージ/ストレージパス');
    const store = require('../../utils/ストレージ/ストア共通');
    const activePath = `${paths.activeDispatchDir(interaction.guildId)}/${dispatchId}.json`;
    const data = await store.readJson(activePath).catch(() => null);
    if (!data) return interaction.editReply("⚠️ 配車データが見つかりません。");

    data.status = 'departing';
    data.departedAt = new Date().toISOString();
    await store.writeJson(activePath, data);

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setFooter({ text: `出発時刻: ${new Date(data.departedAt).toLocaleString('ja-JP')}` })
        .setColor(0xffa500);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`dispatch|order|sub=depart&did=${dispatchId}`).setLabel("出発済").setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId(`dispatch|order|sub=complete&did=${dispatchId}`).setLabel("配送完了・帰庫").setStyle(ButtonStyle.Success).setDisabled(false)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * 配送完了・帰庫処理
 */
async function handleComplete(interaction, dispatchId) {
    const paths = require('../../utils/ストレージ/ストレージパス');
    const store = require('../../utils/ストレージ/ストア共通');
    const activePath = `${paths.activeDispatchDir(interaction.guildId)}/${dispatchId}.json`;
    const data = await store.readJson(activePath).catch(() => null);
    if (!data) return interaction.editReply("⚠️ 配車データが見つかりません。");

    data.status = 'finished';
    data.completedAt = new Date().toISOString();

    // 1. ログ保存 (給与/請求用 & ユーザー個別用)
    try {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const d = now.getDate();

        // 1-A. グローバルログ (全体把握用)
        const logDir = paths.dispatchHistoryDir(interaction.guildId, y, m);
        const logPath = `${logDir}/${dispatchId}.json`;
        await store.writeJson(logPath, data);

        // 1-B. 送迎者個別ログ (送迎履歴)
        if (data.driverId) {
            const driverHistoryPath = paths.driverRideHistoryJson(interaction.guildId, data.driverId, y, m, d);
            await store.updateJson(driverHistoryPath, (existing) => {
                if (!existing || !Array.isArray(existing)) return [data];
                existing.push(data);
                return existing;
            });
        }

        // 1-C. 利用者個別ログ (利用履歴)
        if (data.passengerId) {
            const userHistoryPath = paths.userRideHistoryJson(interaction.guildId, data.passengerId, y, m, d);
            await store.updateJson(userHistoryPath, (existing) => {
                if (!existing || !Array.isArray(existing)) return [data];
                existing.push(data);
                return existing;
            });
        }
    } catch (e) {
        logger.error("配車ログ保存失敗 (一部または全部)", { error: e.message, dispatchId });
    }

    // 2. ドライバーを待機列に戻す（FIFO最後尾）
    const { pushToQueue } = require('../../utils/配車/待機列マネージャ');
    await pushToQueue(interaction.guildId, data.driverId);

    // 3. 配車中データ削除
    await store.deleteFile(activePath);

    // 4. 通知とチャンネル削除
    await interaction.editReply({
        content: "✅ **配送完了・帰庫**\nお疲れ様でした。このチャンネルは10秒後に自動的に削除されます。\nドライバーは待機列の最後尾に戻りました。",
        components: []
    });

    setTimeout(() => {
        interaction.channel.delete().catch(() => null);
    }, 10000);

    // 5. 各パネル更新
    const updateRideListPanel = require('../送迎処理/一覧パネル更新');
    const { updateDriverPanel } = require('../送迎パネル/メイン');
    await Promise.all([
        updateRideListPanel(interaction.guild, interaction.client),
        updateDriverPanel(interaction.guild, interaction.client)
    ]).catch(err => null);

    // 6. 相互評価DMの送信
    const { sendRatingDM } = require('./評価システム');
    await sendRatingDM(interaction.guild, data).catch(err => console.error("評価DM送信失敗", err));
}

/**
 * 相乗り参加ボタン
 */
async function handleCarpoolJoin(interaction, rideId) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
    const modal = new ModalBuilder()
        .setCustomId(`dispatch|order|sub=carpool_modal&rid=${rideId}`)
        .setTitle('相乗り人数入力');

    const countInp = new TextInputBuilder()
        .setCustomId('count')
        .setLabel('追加の乗車人数')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1')
        .setRequired(true)
        .setMaxLength(1);

    modal.addComponents(new ActionRowBuilder().addComponents(countInp));
    // モーダルは ACK 不要 ( interactionTemplate の外で呼ぶ or interactionTemplate で ACK.NONE )
    // ここでは interactionTemplate 内での呼び出しになるため、interaction.showModal が使える
    await interaction.showModal(modal);
}

/**
 * 相乗り参加モーダル送信
 */
async function handleCarpoolModal(interaction, rideId) {
    const paths = require('../../utils/ストレージ/ストレージパス');
    const store = require('../../utils/ストレージ/ストア共通');
    const count = interaction.fields.getTextInputValue('count');
    const cpPath = `${paths.carpoolDir(interaction.guildId)}/${rideId}.json`;
    const carpoolData = await store.readJson(cpPath).catch(() => null);
    if (!carpoolData) return interaction.editReply("⚠️ 募集データが見つかりません。");

    // 配車中データの取得
    const activePath = `${paths.activeDispatchDir(interaction.guildId)}/${carpoolData.dispatchId}.json`;
    const dispatchData = await store.readJson(activePath).catch(() => null);
    if (!dispatchData) return interaction.editReply("⚠️ 配車が既に終了しているか見つかりません。");

    // 重複チェック
    if (carpoolData.currentUsers.some(u => u.userId === interaction.user.id)) {
        return interaction.editReply("⚠️ 既に相乗りリストに含まれています。");
    }

    // データ更新
    carpoolData.currentUsers.push({ userId: interaction.user.id, count: parseInt(count) });
    await store.writeJson(cpPath, carpoolData);

    // プライベートチャンネルへの権限追加
    const { PermissionFlagsBits } = require('discord.js');
    const channel = await interaction.guild.channels.fetch(dispatchData.channelId).catch(() => null);
    if (channel) {
        await channel.permissionOverwrites.create(interaction.user.id, {
            [PermissionFlagsBits.ViewChannel]: true,
            [PermissionFlagsBits.SendMessages]: true,
            [PermissionFlagsBits.ReadMessageHistory]: true
        });
        await channel.send(`➕ <@${interaction.user.id}> 様が相乗りに参加しました（追加人数: ${count}名）。`);
    }

    // 募集メッセージの更新
    const carpoolCh = await interaction.guild.channels.fetch(carpoolData.channelId).catch(() => null);
    if (carpoolCh) {
        const msg = await carpoolCh.messages.fetch(carpoolData.messageId).catch(() => null);
        if (msg) {
            const userList = carpoolData.currentUsers.map(u => `<@${u.userId}> (${u.count}名)`).join('\n');
            const embed = EmbedBuilder.from(msg.embeds[0])
                .setFields(
                    { name: "方面", value: carpoolData.direction, inline: true },
                    { name: "先発店舗", value: `<@${carpoolData.leadUserId}>`, inline: true },
                    { name: "現在の乗員", value: userList, inline: false },
                    { name: "募集状況", value: "相乗り希望者は下のボタンを押してください。出発前であれば追加可能です。", inline: false }
                );
            await msg.edit({ embeds: [embed] });
        }
    }

    await interaction.editReply("✅ 相乗りに参加しました！連絡用チャンネルを確認してください。");
}
