const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, Colors } = require('discord.js');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');

/**
 * 運営者パネル - 運営専用の設定集約パネル
 */
async function sendOperatorPanel(interaction) {
  const handlerRun = async (interaction) => {
    const guild = interaction.guild;
    const config = await loadConfig(guild.id);
    const client = interaction.client;
    const { action, params } = await require('../../utils/parseCustomId').parseCustomId(interaction.customId) || {};

    // 月次レポート出力処理
    if (action === 'report' && params?.sub === 'export') {
      const { exportMonthlyReport } = require('./売上集計');
      const now = new Date();
      const reportText = await exportMonthlyReport(guild, now.getFullYear(), now.getMonth() + 1);

      const { AttachmentBuilder } = require('discord.js');
      const buffer = Buffer.from(reportText, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `稼働レポート_${now.getFullYear()}_${now.getMonth() + 1}.txt` });

      return interaction.editReply({
        content: `📊 **${now.getFullYear()}年${now.getMonth() + 1}月** の詳細稼働レポートを生成しました。`,
        files: [attachment]
      });
    }

    // 埋め込みを作成
    const embed = await buildOperatorPanelEmbed(config, guild.id, client);
    const components = buildOperatorPanelComponents();

    const payload = {
      embeds: [embed],
      components: components,
    };

    // 既存パネルがあれば更新を試みる
    const panel = config.panels?.operatorPanel;
    const channel = interaction.channel;
    let updateSuccess = false;

    if (panel && panel.messageId) {
      const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (msg) {
        try {
          await msg.edit(payload);
          updateSuccess = true;
        } catch (error) {
          console.error('運営者パネル更新エラー:', error);
          if (error.code !== 10008) {
            return interaction.editReply({
              content: '❌ パネルの更新に失敗しました。\n' + error.message,
            });
          }
        }
      }
    }

    if (updateSuccess) {
      return interaction.editReply({ content: '✅ 運営者パネルを更新しました。' });
    }

    // 新規送信
    const panelMsg = await channel.send(payload);
    if (panelMsg) {
      config.panels ??= {};
      config.panels.operatorPanel = {
        channelId: interaction.channelId,
        messageId: panelMsg.id,
      };
      await saveConfig(guild.id, config);
      await interaction.editReply({ content: '✅ 運営者パネルを設置しました。' });
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
    panelKey: 'operatorPanel',
    run: handlerRun,
  });
}

/**
 * 運営者パネルの埋め込みを作成
 */
async function buildOperatorPanelEmbed(config, guildId, client) {
  // 方面リストを読み込む
  const dirListPath = paths.directionsListJson(guildId);
  const directionsList = await store.readJson(dirListPath, []).catch(() => []);

  const directionNames = directionsList
    .filter((d) => d.enabled !== false)
    .map((d) => `${d.name.replace(/【|】/g, '')}`)
    .join('\n') || '未設定';

  // 方面詳細情報を読み込む
  const detailsPath = paths.directionsDetailsJson(guildId);
  const directionDetails = await store.readJson(detailsPath, {}).catch(() => ({}));

  // 利用料読み込み
  const usageFee = config.usageFee || '未設定';

  // 今月の売上（回収利用料）の集計
  const { aggregateMonthlyRevenue } = require('./売上集計');
  const now = new Date();
  const revenueData = await aggregateMonthlyRevenue(guildId, now.getFullYear(), now.getMonth() + 1);

  // 共通の埋め込みテンプレートを使用するように修正 (v2.9.2)
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');

  const fields = [
    {
      name: '📋 運営・実績サマリー', value: [
        `**一律利用料**: \`${usageFee}\``,
        `**今月の回収合計**: **￥${revenueData.totalRevenue.toLocaleString()}** (${revenueData.rideCount} 件)`,
      ].join('\n'), inline: false
    },
    {
      name: '🗺️ 方面リスト情報', value: [
        `\`\`\`\n${directionNames}\n\`\`\``,
      ].join('\n'), inline: false
    },
  ];

  if (directionsList.length > 0) {
    const detailList = directionsList.map((d, i) => {
      const lineKey = `${i + 1}行目`;
      const detailObj = directionDetails[lineKey];
      const dirName = d.name.replace(/【|】/g, '');

      // スレッドIDがあればリンク、なければ（移行前）テキストのみ表示
      if (detailObj && typeof detailObj === 'object' && detailObj.threadId) {
        return `▫️ **${dirName}**: <#${detailObj.threadId}>`;
      } else {
        return `▫️ **${dirName}**: (詳細未登録)`;
      }
    }).join('\n');

    fields.push({
      name: '📍 各方面の詳細（行先方向の町）',
      value: detailList || '未設定',
      inline: false
    });
  }

  return buildPanelEmbed({
    title: '🛠️ 運営者パネル',
    description: '運行に必要な方面リスト、利用料、および詳細情報を集約管理します。',
    color: Colors.Gold,
    client,
    fields: fields
  });
}

/**
 * 運営者パネルのボタン群を生成
 */
function buildOperatorPanelComponents() {
  // Row 1: 方面リスト、詳細
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('op|directions|sub=list_register')
      .setLabel('方面リスト')
      .setEmoji('🗺️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('op|directions|sub=detail_register')
      .setLabel('方面詳細情報')
      .setEmoji('📍')
      .setStyle(ButtonStyle.Primary)
  );

  // Row 2: 利用料、クレジット、レポート
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('op|fee|sub=setting')
      .setLabel('利用料設定')
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('op|credits|sub=start')
      .setLabel('残高チャージ')
      .setEmoji('💳')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('op|report|sub=export')
      .setLabel('月次レポート')
      .setEmoji('📊')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

async function buildOperatorPanelMessage(guild, cfg, client) {
  const embed = await buildOperatorPanelEmbed(cfg, guild.id, client);
  const components = buildOperatorPanelComponents();
  return buildPanelMessage({ embed, components });
}

// 既存のデフォルトエクスポートを維持しつつ、ビルド関数も名前付きで提供する
module.exports = sendOperatorPanel;
module.exports.buildOperatorPanelMessage = buildOperatorPanelMessage;
