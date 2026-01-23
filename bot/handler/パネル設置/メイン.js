const { CUSTOM_ID, requireAdmin } = require('./共通/_panelSetupCommon');

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const { sendOrUpdatePanel } = require('../共通/パネル送信');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const buildPanelSetupEmbed = require('./埋め込み作成');

/**
 * /パネル設置パネル 実行時に呼ばれる
 * パネル設置用の管理パネルを送信・更新する
 */
async function sendPanelSetupPanel(interaction) {
  const handlerRun = async (interaction) => {
    const guild = interaction.guild;
    const config = await loadConfig(guild.id);
    const client = interaction.client;

    const embed = buildPanelSetupEmbed(config, guild.id, client);
    const components = buildPanelSetupComponents(config);

    const payload = {
      embeds: [embed],
      components: components,
    };

    // 既存パネルがあれば更新を試みる
    const panel = config.panels?.panelSetup;
    const channel = interaction.channel;
    let updateSuccess = false;

    if (panel && panel.messageId) {
      const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (msg) {
        try {
          await msg.edit(payload);
          updateSuccess = true;
        } catch (error) {
          console.error('パネル更新エラー:', error);
          if (error.code !== 10008) {
            return interaction.editReply({
              content: '❌ パネルの更新に失敗しました。\n' + error.message,
            });
          }
        }
      }
    }

    if (updateSuccess) {
      return interaction.editReply({ content: '✅ パネル設置パネルを更新しました。' });
    }

    // 新規送信
    const panelMsg = await channel.send(payload);
    if (panelMsg) {
      config.panels ??= {};
      config.panels.panelSetup = {
        channelId: interaction.channelId,
        messageId: panelMsg.id,
      };
      await saveConfig(guild.id, config);
      await interaction.editReply({ content: '✅ パネル設置パネルを設置しました。' });
    } else {
      await interaction.editReply({ content: '❌ パネルの送信に失敗しました。' });
    }
  };

  // Slash Command の場合は直接 ACK
  if (interaction.isChatInputCommand()) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    return handlerRun(interaction);
  }

  // Component の場合は autoInteractionTemplate を利用
  return autoInteractionTemplate(interaction, {
    ack: ACK.AUTO,
    adminOnly: true,
    run: handlerRun,
  });
}

/**
 * パネルの状態を反映したボタン群を生成
 */
function buildPanelSetupComponents(config) {
  // Row 1: 管理者(黒), 運営者(黒), 送迎者(黒), 利用者(黒)
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SEND_ADMIN_PANEL)
      .setLabel('管理者パネル')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ps|send|panel=operator')
      .setLabel('運営者パネル')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SEND_DRIVER_PANEL)
      .setLabel('送迎者パネル')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SEND_USER_PANEL)
      .setLabel('利用者パネル')
      .setStyle(ButtonStyle.Secondary)
  );

  // Row 2: 送迎者登録(グレー), 利用者登録(グレー)
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SEND_DRIVER_REG_PANEL)
      .setLabel('送迎者登録パネル')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SEND_USER_REG_PANEL)
      .setLabel('利用者登録パネル')
      .setStyle(ButtonStyle.Secondary)
  );

  // Row 3: ユーザー確認(青), 送迎一覧(青)
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SEND_USER_CHECK_PANEL)
      .setLabel('ユーザー確認パネル')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SEND_RIDE_LIST_PANEL)
      .setLabel('送迎一覧パネル')
      .setStyle(ButtonStyle.Primary)
  );

  // Row 4: 案内(Secondary), 口コミランク(Secondary), 相乗り(Secondary)
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SEND_GUIDE_PANEL)
      .setLabel('案内パネル')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SEND_RATING_RANK_PANEL)
      .setLabel('口コミランク')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.SEND_CARPOOL_PANEL)
      .setLabel('相乗りパネル')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2, row3, row4];
}

/**
 * 他の操作からパネル의表示状態を更新したい場合に呼ぶ (インタラクション非依存)
 */
async function updatePanelSetupPanel(guild) {
  const config = await loadConfig(guild.id);
  const client = guild.client;

  const panel = config.panels?.panelSetup;
  if (!panel || !panel.channelId || !panel.messageId) return;

  const channel =
    guild.channels.cache.get(panel.channelId) ||
    (await guild.channels.fetch(panel.channelId).catch(() => null));
  if (!channel) return;

  const embed = buildPanelSetupEmbed(config, guild.id, client);
  const components = buildPanelSetupComponents(config);

  await sendOrUpdatePanel({
    channel,
    messageId: panel.messageId,
    buildMessage: () => ({
      embeds: [embed],
      components: components,
    }),
    suppressFallback: true,
  });
}

module.exports = sendPanelSetupPanel;
module.exports.updatePanelSetupPanel = updatePanelSetupPanel;
