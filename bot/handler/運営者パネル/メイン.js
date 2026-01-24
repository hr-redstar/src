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
    .filter((d) => d.enabled !== false) // 有効な方面のみ
    .map((d) => {
      // 方面名から【】があれば除去
      const cleanName = d.name.replace(/【|】/g, '');
      return cleanName;
    })
    .join('\n') || '未設定';

  // 方面詳細情報を読み込む
  const detailsPath = paths.directionsDetailsJson(guildId);
  const directionDetails = await store.readJson(detailsPath, {}).catch(() => ({}));

  // 利用料読み込み
  const usageFee = config.usageFee || '未設定';

  const embed = new EmbedBuilder()
    .setTitle('🛠 運営者パネル')
    .setColor(Colors.Gold)
    .addFields(
      {
        name: '方面リスト',
        value: `\`\`\`\n${directionNames}\n\`\`\``,
        inline: true,
      },
      {
        name: '利用料設定',
        value: `\`\`\`\n${usageFee}\n\`\`\``,
        inline: true,
      }
    );

  // 方面詳細セクション
  embed.addFields({
    name: '方面詳細',
    value: '　',
    inline: false,
  });

  // 各行の詳細情報を表示
  for (let i = 1; i <= directionsList.length; i++) {
    const lineKey = `${i}行目`;
    const detail = directionDetails[lineKey] || '未設定';
    const direction = directionsList[i - 1];
    const dirName = direction ? direction.name.replace(/【|】/g, '') : `${i}行目`;

    embed.addFields({
      name: `方面${i} (${dirName})`,
      value: `\`\`\`\n${detail}\n\`\`\``,
      inline: false,
    });
  }

  // フッターに bot 名と日付を表示
  const botName = client?.user?.username || '送迎bot';
  const now = new Date();
  const today = now.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  embed.setFooter({ text: `${botName}•${today} ${time}` });

  return embed;
}

/**
 * 運営者パネルのボタン群を生成
 */
function buildOperatorPanelComponents() {
  // Row 1: 方面リスト登録、方面詳細登録
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('op|directions|sub=list_register')
      .setLabel('方面リスト登録')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('op|directions|sub=detail_register')
      .setLabel('方面詳細登録')
      .setStyle(ButtonStyle.Primary)
  );

  // Row 2: 利用料設定、ユーザークレジット登録
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('op|fee|sub=setting')
      .setLabel('利用料設定')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('op|credits|sub=start')
      .setLabel('ユーザークレジット登録')
      .setStyle(ButtonStyle.Success)
  );

  // Row 3: 送迎者ランク階級登録、送迎者ランク設定
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('op|rank|sub=class_register')
      .setLabel('送迎者ランク階級登録')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('op|rank|sub=assignment_start')
      .setLabel('送迎者ランク設定')
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2, row3];
}

async function buildOperatorPanelMessage(guild, cfg, client) {
  const embed = await buildOperatorPanelEmbed(cfg, guild.id, client);
  const components = buildOperatorPanelComponents();
  return buildPanelMessage({ embed, components });
}

// 既存のデフォルトエクスポートを維持しつつ、ビルド関数も名前付きで提供する
module.exports = sendOperatorPanel;
module.exports.buildOperatorPanelMessage = buildOperatorPanelMessage;
