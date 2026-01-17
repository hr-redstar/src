const logger = require('./logger');
const store = require('./ストレージ/ストア共通');
const paths = require('./ストレージ/ストレージパス');
const { loadConfig } = require('./設定/設定マネージャ');
const { findUserMemoChannel } = require('./findUserMemoChannel');
const { getRegistrationMessageId } = require('./registrationMessageStore');
const { updateRegistrationInfoMessage } = require('./updateRegistrationInfoMessage');
const { loadDriverFull } = require('./driversStore');
const { loadUserFull } = require('./usersStore');

/**
 * 全ユーザーの登録情報メッセージを一括更新
 * @param {import('discord.js').Client} client 
 */
async function batchUpdateRegistrationMessages(client) {
    logger.info('🔄 [一括更新] 登録情報メッセージの更新バッチを開始します...');

    for (const guild of client.guilds.cache.values()) {
        try {
            const config = await loadConfig(guild.id);
            if (!config.categories?.userMemo) continue;

            const categoryId = config.categories.userMemo;

            // --- ドライバーの更新 ---
            const driverIds = await store.readJson(paths.driverMasterListJson(guild.id), []).catch(() => []);
            for (const userId of driverIds) {
                await processUpdate(guild, userId, 'driver', categoryId, client);
                await sleep(500); // Rate Limit 回避
            }

            // --- 利用者の更新 ---
            const userIds = await store.readJson(paths.userMasterListJson(guild.id), []).catch(() => []);
            for (const userId of userIds) {
                await processUpdate(guild, userId, 'user', categoryId, client);
                await sleep(500); // Rate Limit 回避
            }

        } catch (err) {
            logger.error(`[一括更新] ギルド ${guild.id} でエラー: ${err.message}`);
        }
    }

    logger.info('✅ [一括更新] 登録情報メッセージの更新バッチが完了しました。');
}

/**
 * 個別の更新処理
 */
async function processUpdate(guild, userId, role, categoryId, client) {
    try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return;

        // メモチャンネルを探す
        const channel = await findUserMemoChannel({
            guild,
            userId,
            categoryId,
            role
        }).catch(() => null);

        if (!channel) return;

        // メッセージIDを取得
        const messageId = await getRegistrationMessageId(guild.id, userId, role);
        if (!messageId) return;

        // データのロード
        let fullJson;
        if (role === 'driver') {
            fullJson = await loadDriverFull(guild.id, userId);
        } else {
            fullJson = await loadUserFull(guild.id, userId);
        }

        // 更新実行 (Embed化)
        const success = await updateRegistrationInfoMessage(channel, messageId, fullJson, role, user);

        // メッセージが存在しない場合は新規作成 (復旧)
        if (!success) {
            logger.info(`[一括更新] メッセージ消失を検知、再作成します: User:${userId}`);

            const { buildDriverRegistrationEmbed, buildUserRegistrationEmbed } = require('./buildRegistrationInfoEmbed');
            const { saveRegistrationMessageId } = require('./registrationMessageStore');

            let embed;
            if (role === 'driver') {
                embed = buildDriverRegistrationEmbed(fullJson, user);
            } else {
                embed = buildUserRegistrationEmbed(fullJson, user);
            }

            // 新規送信
            const sentMessage = await channel.send({ embeds: [embed] }).catch(err => {
                logger.error(`[一括更新] 復旧メッセージ送信失敗: ${err.message}`);
                return null;
            });

            if (sentMessage) {
                await saveRegistrationMessageId(guild.id, userId, sentMessage.id, role).catch(err => {
                    logger.error(`[一括更新] 新規メッセージID保存失敗: ${err.message}`);
                });
            }

            // 古い履歴をスレッドに退避
            const { postOldHistoryToThread } = require('./postOldHistoryToThread');
            await postOldHistoryToThread(channel, fullJson.history, role);
        }

    } catch (err) {
        // 個別の失敗はログに出して続行
        logger.debug(`[一括更新] User:${userId} Role:${role} 更新失敗: ${err.message}`);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    batchUpdateRegistrationMessages
};
