const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { formatDateShort } = require('../../utils/共通/日付フォーマット');

/**
 * 評価システム - 送迎終了後の相互評価フロー
 */

/**
 * 送迎終了時に相互に評価依頼DMを送付
 */
async function sendRatingDM(guild, dispatchData) {
    const { dispatchId, driverId, passengerId, direction, route, createdAt, driverStartTime, driverEndTime, userStartTime, userEndTime, completedAt } = dispatchData;

    // 日時フォーマット: MM/DD (HH:mm~HH:mm)
    const dateObj = new Date(completedAt || createdAt || Date.now());
    const dateStr = formatDateShort(dateObj); // MM/DD

    // 時間帯（ドライバー基準、なければ利用者基準、なければ不明）
    const startT = driverStartTime || userStartTime || '--:--';
    const endT = driverEndTime || userEndTime || '--:--';
    const timeRange = `(${startT}~${endT})`;

    // ルート表示
    const routeDisplay = route || direction || "不明なルート";

    // ユーザー情報の取得
    const driver = await guild.client.users.fetch(driverId).catch(() => null);
    const passenger = await guild.client.users.fetch(passengerId).catch(() => null);

    const commonDesc = [
        `${dateStr} ${timeRange}`,
        routeDisplay,
        `送迎者：${driver ? `<@${driver.id}>` : '不明'}`,
        `利用者：${passenger ? `<@${passenger.id}>` : '不明'}`
    ].join('\n');

    // 利用者へのDM（ドライバーを評価）
    if (passenger) {
        const embed = new EmbedBuilder()
            .setTitle("送迎者・利用者口コミ評価")
            .setDescription(`${commonDesc}\n\n今回の送迎はいかがでしたか？`)
            .setColor(0xffd700);

        await passenger.send({
            embeds: [embed],
            components: buildRatingButtons('driver', dispatchId)
        }).catch(() => null);
    }

    // ドライバーへのDM（利用者を評価）
    if (driver) {
        const embed = new EmbedBuilder()
            .setTitle("送迎者・利用者口コミ評価")
            .setDescription(`${commonDesc}\n\n今回の利用者様はいかがでしたか？`)
            .setColor(0xffd700);

        await driver.send({
            embeds: [embed],
            components: buildRatingButtons('user', dispatchId)
        }).catch(() => null);
    }
}

/**
 * 評価用ボタンの構築
 */
function buildRatingButtons(targetType, dispatchId) {
    // 1行目: ⭐5, ⭐4 (Primary)
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`dispatch:rating:${targetType}:${dispatchId}:5`).setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`dispatch:rating:${targetType}:${dispatchId}:4`).setLabel("⭐⭐⭐⭐").setStyle(ButtonStyle.Primary)
    );
    // 2行目: ⭐3, ⭐2, ⭐1 (Secondary)
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`dispatch:rating:${targetType}:${dispatchId}:3`).setLabel("⭐⭐⭐").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`dispatch:rating:${targetType}:${dispatchId}:2`).setLabel("⭐⭐").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`dispatch:rating:${targetType}:${dispatchId}:1`).setLabel("⭐").setStyle(ButtonStyle.Secondary)
    );
    // 3行目: コメント (Success)
    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`dispatch:rating:${targetType}:${dispatchId}:comment`).setLabel("コメントも書きたい").setStyle(ButtonStyle.Success)
    );

    return [row1, row2, row3];
}

/**
 * インタラクションハンドラー
 */
async function execute(interaction, client, parsed) {
    const { action, rest } = parsed;
    const targetType = rest[0]; // 'driver' or 'user'
    const dispatchId = rest[1];
    const value = rest[2];

    const guildId = interaction.guildId || await findGuildIdByDispatchId(dispatchId);
    if (!guildId) return;

    if (value === 'comment') {
        const modal = new ModalBuilder()
            .setCustomId(`dispatch:rating:${targetType}:${dispatchId}:modal`)
            .setTitle("評価コメント入力");

        const input = new TextInputBuilder()
            .setCustomId('comment')
            .setLabel("口コミ・コメント")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder("今回の送迎や利用について、詳しく教えてください。")
            .setRequired(true)
            .setMaxLength(500);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
    }

    const stars = parseInt(value, 10);
    if (isNaN(stars)) return;

    return autoInteractionTemplate(interaction, {
        ack: ACK.UPDATE,
        async run(interaction) {
            const result = await saveRating(guildId, targetType, dispatchId, interaction.user.id, { stars });
            await postRatingToMemo(interaction.guild || await client.guilds.fetch(guildId), targetType, dispatchId, result.current);
            await interaction.editReply({
                content: `✅ 評価（⭐ ${stars}）を更新しました。ありがとうございました！`,
                embeds: [],
            });
        }
    });
}

/**
 * モーダル送信時の処理
 */
async function handleModalSubmit(interaction, parsed) {
    const { rest } = parsed;
    const targetType = rest[0];
    const dispatchId = rest[1];
    const comment = interaction.fields.getTextInputValue('comment');

    const guildId = interaction.guildId || await findGuildIdByDispatchId(dispatchId);
    if (!guildId) return;

    return autoInteractionTemplate(interaction, {
        ack: ACK.REPLY,
        async run(interaction) {
            const result = await saveRating(guildId, targetType, dispatchId, interaction.user.id, { comment });
            // メモチャンネルへの通知
            const guild = interaction.guild || await interaction.client.guilds.fetch(guildId);
            await postRatingToMemo(guild, targetType, dispatchId, result.current);

            await interaction.editReply({
                content: "✅ 口コミを送信しました。ご協力ありがとうございました！",
            });
            if (interaction.message) {
                await interaction.message.edit({ components: buildRatingButtons(targetType, dispatchId) }).catch(() => null);
            }
        }
    });
}

/**
 * 評価の保存（ユーザー別フォルダへ集約）
 */
async function saveRating(guildId, targetType, dispatchId, raterId, data) {
    const paths = require('../../utils/ストレージ/ストレージパス');
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();

    // 1. 対象ユーザーを特定
    const historyPath = `${paths.dispatchHistoryDir(guildId, y, m)}/${dispatchId}.json`;
    const dispatchData = await store.readJson(historyPath).catch(() => null);

    if (!dispatchData) {
        logger.error("評価保存失敗: 配車データが見つかりません", { dispatchId });
        throw new Error("配車データが見つかりません。");
    }

    const targetUserId = (targetType === 'driver') ? dispatchData.driverId : dispatchData.passengerId;
    if (!targetUserId) {
        logger.error("評価保存失敗: 対象ユーザーを特定できません", { dispatchId, targetType });
        throw new Error("対象ユーザーを特定できません。");
    }

    // 2. 保存パスの決定
    const ratingPath = (targetType === 'driver')
        ? paths.driverRatingJson(guildId, targetUserId, y, m, d)
        : paths.userRatingJson(guildId, targetUserId, y, m, d);

    // 2-B. グローバルログ (管理者向け: 全体把握用)
    const typeDir = targetType === 'driver' ? '送迎者' : '利用者';
    const globalRatingPath = `${paths.ratingLogsDir(guildId)}/${typeDir}/${dispatchId}.json`;
    await store.writeJson(globalRatingPath, { ...data, raterId, updatedAt: now.toISOString(), targetUserId });

    // 3. データの更新保存 (配列形式で追記)
    let result = null;
    await store.updateJson(ratingPath, (existing) => {
        const ratingEntry = {
            ...data,
            dispatchId,
            raterId,
            updatedAt: now.toISOString()
        };

        if (!existing || !Array.isArray(existing)) {
            result = { current: ratingEntry, history: [ratingEntry] };
            return [ratingEntry];
        }

        // 同一 dispatchId の評価があれば上書き、なければ追記
        const index = existing.findIndex(r => r.dispatchId === dispatchId);
        if (index >= 0) {
            existing[index] = ratingEntry;
        } else {
            existing.push(ratingEntry);
        }

        result = { current: ratingEntry, history: existing };
        return existing;
    });

    // 4. サマリーの再計算・更新
    const { recalculateRatingSummary } = require('../../utils/ratingsStore');
    await recalculateRatingSummary(guildId, targetUserId, targetType).catch(err => console.error("評価サマリー更新失敗", err));

    return result;
}

/**
 * ユーザーメモチャンネルへの投稿
 */
async function postRatingToMemo(guild, targetType, dispatchId, ratingData) {
    const { loadConfig } = require('../../utils/設定/設定マネージャ');
    const { findUserMemoChannel } = require('../../utils/findUserMemoChannel');
    const config = await loadConfig(guild.id);
    const memoCategoryId = config.categories?.userMemo;
    if (!memoCategoryId) return;

    // 評価対象のユーザーIDを特定する必要がある
    // dispatchId から引くか、保存データに含めるように修正が必要
    // 今回は簡易的に dispatchId の中間に埋め込まれている userId を使う（命名規則依存）
    const parts = dispatchId.split('_');
    // GOタクシー: timestamp_driverId_guildId -> driverId はパーツ[1]
    // 手動: manual_driverId_targetId_guildId
    let targetUserId = null;
    if (parts[0] === 'manual') {
        targetUserId = targetType === 'driver' ? parts[1] : parts[2];
    } else {
        // 配車開始.js の命名: ${Date.now()}_${driver.userId}_${guild.id}
        // 利用者がドライバーを評価する場合はパーツ[1]が対象。ドライバーが利用者を評価する場合は...別途特定が必要。
        // ※ 本来は dispatch データを読み込んで特定するのが確実。
        const paths = require('../../utils/ストレージ/ストレージパス');
        const historyPath = `${paths.dispatchHistoryDir(guild.id, new Date().getFullYear(), new Date().getMonth() + 1)}/${dispatchId}.json`;
        const dispatchData = await store.readJson(historyPath).catch(() => null);
        if (dispatchData) {
            targetUserId = targetType === 'driver' ? dispatchData.driverId : dispatchData.passengerId;
        }
    }

    if (!targetUserId) return;

    const channel = await findUserMemoChannel({ guild, userId: targetUserId, categoryId: memoCategoryId });
    if (!channel) return;

    const starsStr = ratingData.stars ? '⭐'.repeat(ratingData.stars) : '評価なし';
    const embed = new EmbedBuilder()
        .setTitle(`📝 口コミ・評価フィードバック`)
        .setDescription(`<@${ratingData.raterId}> 様より評価が届きました。`)
        .addFields(
            { name: "満足度", value: starsStr, inline: true },
            { name: "コメント", value: ratingData.comment || "（なし）", inline: false }
        )
        .setFooter({ text: `送迎ID: ${dispatchId}` })
        .setTimestamp(new Date(ratingData.updatedAt))
        .setColor(0xffd700);

    await channel.send({ embeds: [embed] }).catch(() => null);
}

async function findGuildIdByDispatchId(dispatchId) {
    const parts = dispatchId.split('_');
    return parts[parts.length - 1];
}

module.exports = {
    sendRatingDM,
    execute,
    handleModalSubmit
};
