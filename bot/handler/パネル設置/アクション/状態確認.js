const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const { loadConfig } = require('../../../utils/設定/設定マネージャ');
const { getRatingSummary } = require('../../../utils/ratingsStore');

module.exports = {
  customId: 'ps|check',
  type: 'button',
  async execute(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.REPLY, // Ephemeral status check should be a reply
      async run(interaction) {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const paths = require('../../../utils/ストレージ/ストレージパス');
        const _userProfile = await store
          .readJson(paths.userProfileJson(guildId, userId))
          .catch(() => null);
        const _driverProfile = await store
          .readJson(paths.driverProfileJson(guildId, userId))
          .catch(() => null);

        // current プロパティがある場合はそれを採用 (ヒストリー構造対応)
        const userProfile = _userProfile?.current || _userProfile;
        const driverProfile = _driverProfile?.current || _driverProfile;

        const isUserRegistered = userProfile && userProfile.name;
        const isDriverRegistered = driverProfile && driverProfile.nickname;

        const embed = new EmbedBuilder()
          .setTitle('🔍 登録状態確認')
          .setColor(0x3498db)
          .setTimestamp();

        const components = [];

        if (!isUserRegistered && !isDriverRegistered) {
          embed.setDescription('登録情報が見つかりませんでした。先に登録を行ってください。');
          components.push(
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('reg|user|sub=button')
                .setLabel('利用者登録へ')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('reg|driver|sub=button')
                .setLabel('送迎者登録へ')
                .setStyle(ButtonStyle.Secondary)
            )
          );
        } else {
          const config = await loadConfig(guildId);
          const userRanks = config.ranks?.userRanks || {};

          let desc = '';
          if (isUserRegistered) {
            const rank = userRanks[userId] || '設定なし';
            const rating = await getRatingSummary(guildId, userId, 'user');
            const stars = rating?.average ? '⭐'.repeat(Math.round(rating.average)) + ` (${rating.average})` : '未評価';

            desc += `**【👤 利用者情報】**\n`;
            desc += `ニックネーム: \`${userProfile.name}\`\n`;
            desc += `ランク: \`${rank}\` / 評価: ${stars}\n`;
            desc += `送迎目印: \`${userProfile.mark || '未設定'}\`\n\n`;
          }
          if (isDriverRegistered) {
            const rank = userRanks[userId] || '設定なし';
            const rating = await getRatingSummary(guildId, userId, 'driver');
            const stars = rating?.average ? '⭐'.repeat(Math.round(rating.average)) + ` (${rating.average})` : '未評価';

            desc += `**【🚗 送迎者情報】**\n`;
            desc += `ニックネーム: \`${driverProfile.nickname}\`\n`;
            desc += `ランク: \`${rank}\` / 評価: ${stars}\n`;
            desc += `待機場所: \`${driverProfile.stopPlace || driverProfile.stop || '未設定'}\`\n`;
            desc += `乗車定員: \`${driverProfile.capacity}\`名\n`;
          }
          embed.setDescription(desc);
        }

        await interaction.editReply({ embeds: [embed], components });
      },
    });
  },
};
