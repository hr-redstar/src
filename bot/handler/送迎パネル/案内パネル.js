const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const { updateAdminPanelMessage } = require('../管理者パネル/メイン');

/**
 * 案内パネルのメッセージ（Embed群）を構築する
 */
async function buildGuidePanelMessage(guild, config, client) {
  const guildId = guild.id;
  const makeLink = (p) =>
    p && p.channelId && p.messageId
      ? `📌 <#${p.channelId}>\n🔗 [パネルを開く](https://discord.com/channels/${guildId}/${p.channelId}/${p.messageId})`
      : '⚠️ 未設置';

  const embeds = [];

  // メインEmbed
  embeds.push(
    new EmbedBuilder()
      .setTitle('案内パネル')
      .setDescription('送迎システムの各種操作はこちらから行えます。')
      .setColor(0x3498db)
  );

  // 送迎者向け
  embeds.push(
    new EmbedBuilder()
      .setTitle('🚗 送迎者向け')
      .addFields(
        {
          name: '送迎者登録パネル',
          value: makeLink(config.panels?.driverRegister),
        },
        {
          name: '送迎者パネル',
          value: makeLink(config.panels?.driverPanel),
        }
      )
      .setColor(0x2ecc71)
  );

  // 利用者向け
  embeds.push(
    new EmbedBuilder()
      .setTitle('👤 利用者向け')
      .addFields(
        {
          name: '利用者登録パネル',
          value: makeLink(config.panels?.userRegister),
        },
        {
          name: '利用者パネル',
          value: makeLink(config.panels?.userPanel),
        }
      )
      .setColor(0xf1c40f)
  );

  // 送迎マッチング後
  embeds.push(
    new EmbedBuilder()
      .setTitle('🔐 送迎マッチング後')
      .setDescription(
        `送迎がマッチングされると、指定されたカテゴリー内に\n送迎者と利用者専用のプライベートVCチャンネルが作成されます。\n\n` +
          `📁 カテゴリー：${config.categories?.privateVc ? `<#${config.categories.privateVc}>` : '**未設定**'}\n` +
          `📘 使い方：<#${config.channels?.operatorLog || config.logs?.operatorChannel || '未設定'}>（※プライベートVCガイド）`
      )
      .setColor(0x9b59b6)
  );

  return { embeds };
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
