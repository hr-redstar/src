const { EmbedBuilder } = require('discord.js');
const { installPanel } = require('../共通/設置テンプレ');
const { updatePanelSetupPanel } = require('../メイン');
const { loadConfig, saveConfig } = require('../../../utils/設定/設定マネージャ');
const interactionTemplate = require('../../共通/interactionTemplate');
const { ACK } = interactionTemplate;

module.exports = {
  customId: 'ps:modal:guideContent', // 接頭辞で判定する想定
  type: 'modal',
  async execute(interaction) {
    const parts = interaction.customId.split(':');
    const channelId = parts[3]; // ps:modal:guideContent:channelId

    return interactionTemplate(interaction, {
      ack: ACK.REPLY,
      adminOnly: true,
      async run(interaction) {
        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
          return interaction.editReply({ content: '❌ 送信先チャンネルが見つかりませんでした。' });
        }

        const guild = interaction.guild;
        const guildId = guild.id;
        const client = interaction.client;

        const ok = await installPanel({
          interaction,
          panelKey: 'guide',
          panelName: '案内パネル',
          channel,
          buildMessage: async () => {
            const config = await loadConfig(guildId);
            const makeLink = (p) =>
              p && p.channelId && p.messageId
                ? `📌 <#${p.channelId}>\n🔗 [パネルを開く](https://discord.com/channels/${guildId}/${p.channelId}/${p.messageId})`
                : '⚠️ 未設置';

            const embeds = [];
            // メインEmbed (カスタム入力)
            embeds.push(
              new EmbedBuilder().setTitle(title).setDescription(description).setColor(0x3498db)
            );

            // 送迎者向け
            embeds.push(
              new EmbedBuilder()
                .setTitle('🚗 送迎者向け')
                .addFields(
                  { name: '送迎者登録パネル', value: makeLink(config.panels?.driverRegister) },
                  { name: '送迎者パネル', value: makeLink(config.panels?.driverPanel) }
                )
                .setColor(0x2ecc71)
            );

            // 利用者向け
            embeds.push(
              new EmbedBuilder()
                .setTitle('👤 利用者向け')
                .addFields(
                  { name: '利用者登録パネル', value: makeLink(config.panels?.userRegister) },
                  { name: '利用者パネル', value: makeLink(config.panels?.userPanel) }
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
                    `📘 使い方：${config.logs?.operatorChannel ? `<#${config.logs.operatorChannel}>` : '**未設定**'}`
                )
                .setColor(0x9b59b6)
            );

            return { embeds };
          },
        });

        if (ok) {
          await updatePanelSetupPanel(guild);
          await interaction.editReply({
            content: `✅ <#${channel.id}> に **案内パネル** を設置しました。`,
          });
        } else {
          await interaction.editReply({ content: `❌ 案内パネルの送信に失敗しました。` });
        }
      },
    });
  },
};
