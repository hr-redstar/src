const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const { updateAdminPanelMessage } = require('../管理者パネル/メイン');

/**
 * 案内パネルのメッセージ（Embed群）を構築する
 */
async function buildGuidePanelMessage(guild, config, client) {
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');
  const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');

  const guildId = guild.id;
  const makeLink = (p) =>
    p && p.channelId && p.messageId
      ? `📌 <#${p.channelId}>\n🔗 [パネルを開く](https://discord.com/channels/${guildId}/${p.channelId}/${p.messageId})`
      : '⚠️ 未設置';

  const embed = buildPanelEmbed({
    title: '📘 送迎システム 総合案内',
    description: '送迎システムの各種パネルへのリンクとガイドです。目的のパネルにアクセスして操作を行ってください。',
    color: 0x3498db,
    client,
    fields: [
      {
        name: '🚗 送迎者（ドライバー）向け',
        value: `【送迎者登録】\n${makeLink(config.panels?.driverRegister)}\n\n【送迎者パネル】\n${makeLink(config.panels?.driverPanel)}`,
        inline: true
      },
      {
        name: '👤 利用者（ゲスト）向け',
        value: `【利用者登録】\n${makeLink(config.panels?.userRegister)}\n\n【利用者パネル】\n${makeLink(config.panels?.userPanel)}`,
        inline: true
      },
      {
        name: '🔐 送迎マッチング後の流れ',
        value: `マッチングが成立すると、専用のプライベートVCチャンネルが作成されます。\n\n📁 カテゴリー：${config.categories?.privateVc ? `<#${config.categories.privateVc}>` : '**未設定**'}\n📘 ガイド：<#${config.channels?.operatorLog || config.logs?.operatorChannel || '未設定'}>`,
        inline: false
      }
    ]
  });

  return buildPanelMessage({ embed });
}

/**
 * 案内パネルの設置（コマンド/ボタンから呼ばれる）
 */
async function sendGuidePanel(interaction) {
  const guildId = interaction.guildId;
  const channel = interaction.channel;
  const client = interaction.client;
  const { installPanel } = require('../パネル設置/共通/設置テンプレ');

  const config = await loadConfig(guildId);

  const ok = await installPanel({
    interaction,
    panelKey: 'guide',
    panelName: '案内パネル',
    channel,
    buildMessage: () => buildGuidePanelMessage(interaction.guild, config, client),
  });

  if (ok) {
    await updateAdminPanelMessage(interaction.guild, config, client).catch(() => null);
    await interaction.editReply({
      content: '✅ 案内パネルを設置しました。',
    });
  } else {
    await interaction.editReply({
      content: '❌ 案内パネルの送信に失敗しました。',
    });
  }
}

module.exports = sendGuidePanel;
module.exports.buildGuidePanelMessage = buildGuidePanelMessage;
