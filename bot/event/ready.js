const { Events, ActivityType } = require('discord.js');
const logger = require('../utils/logger');
const { loadConfig, saveConfig } = require('../utils/設定/設定マネージャ');
const { sendOrUpdatePanel } = require('../handler/共通/パネル送信');
const store = require('../utils/ストレージ/ストア共通');
const paths = require('../utils/ストレージ/ストレージパス');
const { buildAdminPanelMessage } = require('../handler/管理者パネル/メイン');
const { buildDriverPanelMessage, buildRideListPanelMessage } = require('../handler/送迎パネル/メイン');
const { buildUserPanelMessage } = require('../handler/利用者パネル/メイン');
const { buildDriverRegPanelMessage } = require('../handler/登録処理/送迎者登録');
const { buildUserRegPanelMessage } = require('../handler/登録処理/利用者登録');
const { buildUserCheckPanelMessage } = require('../handler/登録処理/ユーザー確認パネル');
const { buildGuidePanelMessage } = require('../handler/送迎パネル/案内パネル');
const { ensureGuideChannel } = require('../handler/共通/ガイドチャンネル作成');
const { buildPrivateVcGuide } = require('../handler/ガイド/プライベートVC');
const { buildUserMemoGuide } = require('../handler/ガイド/個人メモ');

const { buildRatingRankPanelMessage } = require('../handler/管理者パネル/口コミランクパネル構築');
const { buildOperatorPanelMessage } = require('../handler/運営者パネル/メイン');

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    // 起動ログ（日本語）
    logger.info(`起動しました：${client.user.tag}`);

    // ステータス表示
    try {
      client.user.setPresence({
        status: 'online',
        activities: [{ name: '送迎パネル', type: ActivityType.Watching }],
      });
      logger.debug('プレゼンスを設定しました', {
        status: 'online',
        activity: '送迎パネル',
        type: 'Watching',
      });
    } catch (e) {
      logger.warn('プレゼンス設定に失敗しました', {
        error: logger.formatError ? logger.formatError(e).split('\n')[0] : String(e),
      });
      // 詳細はデバッグに回す（長いstackをerrorに混ぜない）
      logger.debug('プレゼンス設定エラー詳細', logger.formatError ? logger.formatError(e) : e);
    }

    // 全ギルドの出勤状態をGCSと同期 (Legacy logic removed temporarily)
    /*
    try {
      const guilds = [...client.guilds.cache.values()];
      logger.info("出勤状態の同期を開始します", { guildCount: guilds.length });

      for (const guild of guilds) {
        // await cleanupAvailabilityAgainstRegistry(client, guild.id);
        logger.debug("ギルドの同期が完了しました", { guildId: guild.id, guildName: guild.name });
      }

      logger.info("全ギルドの出勤状態の同期が完了しました");
    } catch (e) {
      logger.error("出勤状態の同期に失敗しました", {
        error: logger.formatError ? logger.formatError(e).split("\n")[0] : String(e),
      });
      logger.debug("同期エラー詳細", logger.formatError ? logger.formatError(e) : e);
    }
    */

    // ===== パネル自動復旧処理 =====
    logger.info('パネルの自動復旧を開始します...');
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await loadConfig(guild.id);
        if (!config.panels) continue;

        let needsSave = false;
        for (const [key, data] of Object.entries(config.panels)) {
          if (!data || typeof data !== 'object' || !data.channelId || !data.messageId) continue;

          try {
            const channel = await guild.channels.fetch(data.channelId).catch(() => null);
            if (!channel) continue;

            const newMessageId = await sendOrUpdatePanel({
              channel,
              messageId: data.messageId,
              buildMessage: async () => {
                logger.debug(`[パネル復旧] メッセージ構築中: ${key}`);
                switch (key) {
                  case 'admin':
                    return buildAdminPanelMessage(guild, config, client);
                  case 'driverPanel': {
                    // 待機中の送迎者数をカウント
                    const { getQueue } = require('../utils/配車/待機列マネージャ');
                    const queue = await getQueue(guild.id);
                    const waitingCount = queue ? queue.length : 0;

                    // 送迎中（実車中）の送迎車数をカウント
                    const activeDispatchDir = paths.activeDispatchDir(guild.id);
                    const activeFiles = await store.listKeys(activeDispatchDir).catch(() => []);
                    const workingCount = activeFiles.filter((f) => f.endsWith('.json')).length;

                    const activeCount = waitingCount + workingCount;
                    return buildDriverPanelMessage(guild, activeCount, client);
                  }
                  case 'userPanel': {
                    // 待機中の送迎者数をカウント
                    const { getQueue } = require('../utils/配車/待機列マネージャ');
                    const queue = await getQueue(guild.id);
                    const waitingCount = queue ? queue.length : 0;

                    // 送迎中（実車中）の送迎車数をカウント
                    const activeDispatchDir = paths.activeDispatchDir(guild.id);
                    const activeFiles = await store.listKeys(activeDispatchDir).catch(() => []);
                    const workingCount = activeFiles.filter((f) => f.endsWith('.json')).length;

                    const activeCount = waitingCount + workingCount;
                    return buildUserPanelMessage(guild, activeCount, client);
                  }
                  case 'driverRegister':
                    return buildDriverRegPanelMessage(guild, client);
                  case 'userRegister':
                    return buildUserRegPanelMessage(guild, client);
                  case 'userCheckPanel':
                    return buildUserCheckPanelMessage(guild, client);
                  case 'rideList':
                    return buildRideListPanelMessage(guild, client);
                  case 'ratingRank':
                    return buildRatingRankPanelMessage(guild);
                  case 'operatorPanel':
                    return await buildOperatorPanelMessage(guild, config, client);
                  case 'guide':
                    return buildGuidePanelMessage(guild, config, client);
                  default:
                    return null;
                }
              },
            });

            if (newMessageId && newMessageId !== data.messageId) {
              logger.info(`[パネル復旧] ID更新: ${key} (${data.messageId} -> ${newMessageId})`);
              config.panels[key].messageId = newMessageId;
              needsSave = true;
            } else if (newMessageId) {
              logger.debug(`[パネル復旧] 更新完了: ${key}`);
            }
          } catch (err) {
            logger.warn(`ギルド(${guild.id}) のパネル復旧失敗 [${key}]: ${err.message}`);
          }
        }
        if (needsSave) {
          await saveConfig(guild.id, config).catch((err) => {
            logger.error(
              `ギルド(${guild.id}) のパネル復旧後の設定保存に失敗しました: ${err.message}`
            );
          });
        }
      } catch (err) {
        logger.error(
          `ギルド(${guild.id}) の設定ロードまたは復旧中にエラーが発生しました: ${err.message}`
        );
      }
    }
    logger.info('パネルの自動復旧が完了しました。');

    // ===== ガイドチャンネルの自動チェック・復旧 =====
    logger.info('ガイドチャンネルのチェックを開始します...');
    for (const guild of client.guilds.cache.values()) {
      try {
        const config = await loadConfig(guild.id);
        if (!config.categories) continue;

        // プライベートVCカテゴリー
        if (config.categories.privateVc) {
          await ensureGuideChannel({
            guild,
            categoryId: config.categories.privateVc,
            channelName: '📝プライベートVCの使い方',
            messageBuilder: buildPrivateVcGuide,
          });
        }

        // ユーザーメモカテゴリー
        if (config.categories.userMemo) {
          await ensureGuideChannel({
            guild,
            categoryId: config.categories.userMemo,
            channelName: '📝個人メモの使い方',
            messageBuilder: buildUserMemoGuide,
          });
        }
      } catch (err) {
        logger.warn(`ギルド(${guild.id}) のガイドチャンネルチェック失敗: ${err.message}`);
      }
    }
    logger.info('ガイドチャンネルのチェックが完了しました。');

    // ===== 全ユーザー登録情報メッセージの一括更新 (Embed化対応) =====
    const { batchUpdateRegistrationMessages } = require('../utils/batchUpdateRegistrationMessages');
    // awaitせずにバックグラウンドで実行
    batchUpdateRegistrationMessages(client).catch((err) => {
      logger.error(`一括更新バッチ起動失敗: ${err.message}`);
    });
  },
};
