const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const interactionTemplate = require("../../共通/interactionTemplate");
const { ACK } = interactionTemplate;

module.exports = {
  async execute(interaction) {
    return interactionTemplate(interaction, {
      ack: ACK.REPLY,
      async run(interaction) {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const paths = require('../../../utils/ストレージ/ストレージパス');
        const userProfile = await store.readJson(paths.userProfileJson(guildId, userId)).catch(() => null);
        const driverProfile = await store.readJson(paths.driverProfileJson(guildId, userId)).catch(() => null);

        const embed = new EmbedBuilder()
          .setTitle('🔍 登録状態確認')
          .setColor(0x3498db)
          .setTimestamp();

        const components = [];

        if (!userProfile && !driverProfile) {
          embed.setDescription('登録情報が見つかりませんでした。先に登録を行ってください。');
          components.push(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('user:goto:register').setLabel('利用者登録へ').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('driver:goto:register').setLabel('送迎者登録へ').setStyle(ButtonStyle.Secondary)
            )
          );
        } else {
          let desc = '';
          if (userProfile) {
            desc += `**【👤 利用者】**\n座席名/ニックネーム: \`${userProfile.name}\`\n送迎目印: \`${userProfile.mark}\`\n\n`;
          }
          if (driverProfile) {
            desc += `**【🛠 送迎者】**\nニックネーム: \`${driverProfile.nickname}\`\n待機場所: \`${driverProfile.stopPlace}\`\n乗車人数: \`${driverProfile.capacity}\`名\n`;
          }
          embed.setDescription(desc);
        }

        await interaction.editReply({ embeds: [embed], components });
      }
    });
  },
};
