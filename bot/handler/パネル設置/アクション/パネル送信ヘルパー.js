const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PANEL_SETUP_IDS } = require('../共通/_panelSetupCommon');
const { loadConfig, saveConfig } = require('../../../utils/設定/設定マネージャ');
const { updateAdminPanelMessage } = require('../../管理者パネル/メイン');
const { updatePanelSetupPanel } = require('../メイン');

// 各パネルのメッセージ生成ロジック
// 元のハンドラファイルからロジックをコピー、またはインポートして使用する設計
// ここでは、依存関係を減らすために直接メッセージを構築する形をとる（UIの統一性維持のため）

module.exports.sendSpecificPanel = async function (guild, channel, panelType) {
  let payload = null;

  switch (panelType) {
    case 'driver_panel': {
      const { buildDriverPanelMessage } = require('../../送迎パネル/メイン');
      const { getQueue } = require('../../../utils/配車/待機列マネージャ');
      const queue = await getQueue(guild.id);
      payload = buildDriverPanelMessage(guild, queue.length, guild.client);
      break;
    }

    case 'user_panel': {
      const { buildUserPanelMessage } = require('../../利用者パネル/メイン');
      const { getQueue } = require('../../../utils/配車/待機列マネージャ');
      const paths = require('../../../utils/ストレージ/ストレージパス');
      const store = require('../../../utils/ストレージ/ストア共通');
      const queue = await getQueue(guild.id);
      const activeDispatchDir = paths.activeDispatchDir(guild.id);
      const activeFiles = await store.listKeys(activeDispatchDir).catch(() => []);
      const workingCount = activeFiles.filter((f) => f.endsWith('.json')).length;
      payload = buildUserPanelMessage(guild, queue.length + workingCount, guild.client);
      break;
    }

    case 'ride_list_panel': {
      const { buildRideListPanelMessage } = require('../../送迎パネル/埋め込み作成');
      payload = await buildRideListPanelMessage(guild, guild.client);
      break;
    }

    case 'driver_reg_panel': {
      const { buildDriverRegPanelMessage } = require('../../登録処理/送迎者登録');
      payload = buildDriverRegPanelMessage(guild, guild.client);
      break;
    }

    case 'user_reg_panel': {
      const { buildUserRegPanelMessage } = require('../../登録処理/利用者登録');
      payload = buildUserRegPanelMessage(guild, guild.client);
      break;
    }

    case 'user_check_panel': {
      const { buildUserCheckPanelMessage } = require('../../登録処理/ユーザー確認パネル');
      payload = await buildUserCheckPanelMessage(guild, guild.client);
      break;
    }

    case 'rating_rank_panel': {
      const { buildRatingRankPanelMessage } = require('../../管理者パネル/口コミランクパネル構築');
      payload = buildRatingRankPanelMessage(guild);
      break;
    }

    case 'admin_panel': {
      const { buildAdminPanelMessage } = require('../../管理者パネル/メイン');
      const config = await loadConfig(guild.id);
      payload = buildAdminPanelMessage(guild, config, guild.client);
      break;
    }

    case 'guide_panel': {
      const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
      const buildPanelMessage = require('../../../utils/embed/panelMessageTemplate');
      const embed = buildPanelEmbed({
        title: '🔰 案内パネル',
        description: '送迎依頼のやり方や、よくある質問をまとめています。\n詳細は各マニュアルを確認してください。',
        client: guild.client
      });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('guide:vc')
          .setLabel('VCの使い方')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('guide:memo')
          .setLabel('個人メモについて')
          .setStyle(ButtonStyle.Secondary)
      );
      payload = buildPanelMessage({ embed, components: [row] });
      break;
    }

    default:
      throw new Error(`未対応のパネル種別です: ${panelType}`);
  }

  if (payload) {
    const sentMsg = await channel.send(payload);

    // 設定に保存 (自動同期)
    const config = await loadConfig(guild.id);
    const keyMap = {
      driver_panel: 'driverPanel',
      user_panel: 'userPanel',
      ride_list_panel: 'rideList',
      driver_reg_panel: 'driverRegister',
      user_reg_panel: 'userRegister',
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

      // 他の管理パネルも同期更新（表示状態を反映させるため）
      await updateAdminPanelMessage(guild, config, guild.client);
      await updatePanelSetupPanel(guild);
    }
  }
};
