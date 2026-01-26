const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
const { installPanel } = require('../共通/設置テンプレ');
const { updatePanelSetupPanel } = require('../メイン');
const { loadConfig, saveConfig } = require('../../../utils/設定/設定マネージャ');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = {
  customId: 'ps|modal|sub=guideContent',
  type: 'modal',
  async execute(interaction, client, parsed) {
    // Custom ID: ps|modal|sub=guideContent&cid=channelId
    const channelId = parsed.params?.cid || parsed.params?.legacy?.[1];

    return autoInteractionTemplate(interaction, {
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
              buildPanelEmbed({
                title,
                description,
                type: 'info',
                client: interaction.client
              })
            );

            // 送迎者向け
            embeds.push(
              buildPanelEmbed({
                title: '🚗 送迎者向け',
                fields: [
                  { name: '送迎者登録パネル', value: makeLink(config.panels?.driverRegister) },
                  { name: '送迎者パネル', value: makeLink(config.panels?.driverPanel) }
                ],
                type: 'info',
                client: interaction.client
              })
            );

            // 利用者向け
            embeds.push(
              buildPanelEmbed({
                title: '👤 利用者向け',
                fields: [
                  { name: '利用者登録パネル', value: makeLink(config.panels?.userRegister) },
                  { name: '利用者パネル', value: makeLink(config.panels?.userPanel) }
                ],
                type: 'warning',
                client: interaction.client
              })
            );

            // 送迎マッチング後
            embeds.push(
              buildPanelEmbed({
                title: '🔐 送迎マッチング後',
                description: [
                  `送迎がマッチングされると、指定されたカテゴリー内に`,
                  `送迎者と利用者専用のプライベートVCチャンネルが作成されます。`,
                  '',
                  `📁 カテゴリー：${config.categories?.privateVc ? `<#${config.categories.privateVc}>` : '**未設定**'}`,
                  `📘 使い方：${config.logs?.operatorChannel ? `<#${config.logs.operatorChannel}>` : '**未設定**'}`
                ].join('\n'),
                type: 'info',
                client: interaction.client
              })
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
