// handler/パネル設置/アクション/パネル送信ヘルパー.js
// v1.6.2 (Professional Setup)

const { loadConfig, saveConfig } = require('../../../utils/設定/設定マネージャ');
const { updateAdminPanelMessage } = require('../../管理者パネル/メイン');
const { updatePanelSetupPanel } = require('../メイン');
const { postAdminActionLog } = require('../../../utils/ログ/管理者ログ');

/**
 * 整理されたパネルビルダーのマッピング
 */
const PANEL_BUILDERS = {
  driver_panel: require('../../送迎パネル/メイン').buildDriverPanelMessage,
  user_panel: require('../../利用者パネル/メイン').buildUserPanelMessage,
  admin_panel: require('../../管理者パネル/メイン').buildAdminPanelMessage,
  ride_list_panel: require('../../送迎パネル/埋め込み作成').buildRideListPanelMessage,
  driver_reg_panel: require('../../登録処理/送迎者登録').buildDriverRegPanelMessage,
  user_reg_panel: require('../../登録処理/利用者登録').buildUserRegPanelMessage,
  user_check_panel: require('../../登録処理/ユーザー確認パネル').buildUserCheckPanelMessage,
  rating_rank_panel: require('../../管理者パネル/口コミランクパネル構築').buildRatingRankPanelMessage,
};

/**
 * パネル種別名の正規化
 */
const TYPE_MAP = {
  driver: 'driver_panel',
  user: 'user_panel',
  rideList: 'ride_list_panel',
  driverRegister: 'driver_reg_panel',
  userRegister: 'user_reg_panel',
  userCheck: 'user_check_panel',
  ratingRank: 'rating_rank_panel',
  admin: 'admin_panel',
  guide: 'guide_panel',
};

/**
 * パネルを指定されたチャンネルにデプロイし、設定を更新する
 */
async function deployPanel({ guild, channelId, panelType: rawType, user }) {
  const panelType = TYPE_MAP[rawType] || rawType;
  const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) throw new Error('設置先チャンネルが見つかりませんでした。');

  // ビルダーの取得
  const builder = PANEL_BUILDERS[panelType];
  let payload;

  if (builder) {
    // 既存の標準ビルダーを使用
    if (panelType === 'driver_panel' || panelType === 'user_panel') {
      const { getQueue } = require('../../../utils/配車/待機列マネージャ');
      const queue = await getQueue(guild.id);
      const waitingCount = queue ? queue.length : 0;

      let totalCount = waitingCount;
      if (panelType === 'user_panel') {
        const store = require('../../../utils/ストレージ/ストア共通');
        const paths = require('../../../utils/ストレージ/ストレージパス');
        const activeFiles = await store.listKeys(paths.activeDispatchDir(guild.id)).catch(() => []);
        totalCount += activeFiles.filter(f => f.endsWith('.json')).length;
      }
      payload = await builder(guild, totalCount, guild.client);
    } else if (panelType === 'admin_panel') {
      const config = await loadConfig(guild.id);
      payload = await builder(guild, config, guild.client);
    } else if (panelType === 'rating_rank_panel') {
      payload = await builder(guild);
    } else {
      payload = await builder(guild, guild.client);
    }
  } else if (panelType === 'guide_panel') {
    // 案内パネルのみヘルパー内で構築（特殊なため）
    const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
    const buildPanelMessage = require('../../../utils/embed/panelMessageTemplate');
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    const embed = buildPanelEmbed({
      title: '🔰 送迎システム利用案内',
      description: '当サーバーの送迎システムへようこそ！\n以下のボタンから各機能の使い方を確認できます。',
      color: 0x3498db,
      client: guild.client
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('guide|vc')
        .setLabel('VC・配車の流れ')
        .setEmoji('🚕')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('guide|memo')
        .setLabel('個人メモ機能')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Secondary)
    );
    payload = buildPanelMessage({ embed, components: [row] });
  }

  if (!payload) throw new Error(`未対応のパネル種別です: ${panelType}`);

  // 送信
  const sentMsg = await channel.send(payload);

  // 設定更新
  const config = await loadConfig(guild.id);
  const keyMap = {
    driver_panel: 'driverPanel',
    user_panel: 'userPanel',
    ride_list_panel: 'rideList',
    driver_reg_panel: 'driverRegister',
    user_reg_panel: 'userRegister',
    user_check_panel: 'userCheckPanel',
    rating_rank_panel: 'ratingRank',
    admin_panel: 'admin',
    guide_panel: 'guide',
  };

  const targetKey = keyMap[panelType];
  if (targetKey) {
    if (!config.panels) config.panels = {};
    config.panels[targetKey] = {
      channelId: channel.id,
      messageId: sentMsg.id,
    };
    await saveConfig(guild.id, config);

    // 関連パネルの更新
    await updateAdminPanelMessage(guild, config, guild.client).catch(() => null);
    await updatePanelSetupPanel(guild).catch(() => null);
  }

  // 管理者ログ
  const typeLabel = panelType.replace('_panel', '').replace('_reg', '登録').toUpperCase();
  await postAdminActionLog({
    guild,
    user,
    title: '📌 パネル設置完了',
    description: `**${typeLabel}** を <#${channelId}> に設置しました。`,
  }).catch(() => null);

  return sentMsg;
}

module.exports = {
  deployPanel,
  sendSpecificPanel: (guild, channel, panelType) =>
    deployPanel({ guild, channelId: channel.id, panelType, user: { id: 'SYSTEM' } }),
};
