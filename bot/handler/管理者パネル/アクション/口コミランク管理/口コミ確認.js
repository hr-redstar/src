const {
  UserSelectMenuBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { aggregateUserRatings } = require('./集計ロジック');
const store = require('../../../../utils/ストレージ/ストア共通');
const paths = require('../../../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

const CID = {
  BTN_RATING_CHECK: 'admin:btn:rating_check_start',
  SEL_USER: 'admin:select:rating_user',
  BTN_COMMENT_VIEW: 'admin:btn:comment_check',
};

module.exports = {
  CID,

  /**
   * ボタン押下：ユーザー選択を表示
   */
  async startFlow(interaction) {
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CID.SEL_USER)
        .setPlaceholder('評価を確認するユーザーを選択してください')
    );
    return interaction.reply({
      content: '👤 評価を確認したいユーザーを選択してください。',
      components: [row],
      flags: 64,
    });
  },

  /**
   * ユーザー選択後：統計Embedを表示
   */
  async showStats(interaction) {
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.UPDATE,
      async run(interaction) {
        const targetUserId = interaction.values[0];
        const guildId = interaction.guildId;
        const stats = await aggregateUserRatings(guildId, targetUserId);

        const targetUser = await interaction.guild.members
          .fetch(targetUserId)
          .catch(() => ({ displayName: targetUserId, user: { displayAvatarURL: () => null } }));

        // 星の表示ロジック
        const fullStars = Math.floor(stats.average);
        const starLine = '⭐'.repeat(fullStars) + (stats.average % 1 >= 0.5 ? '🌓' : '');

        const embed = new EmbedBuilder()
          .setTitle(`📊 口コミ・評価統計: ${targetUser.displayName}`)
          .setThumbnail(targetUser.user.displayAvatarURL())
          .addFields(
            {
              name: '総合評価',
              value: `**${stats.average}** ${starLine} (${stats.totalCount}件)`,
              inline: false,
            },
            {
              name: '評価内訳',
              value: [
                `⭐⭐⭐⭐⭐ （${stats.starCounts['5']}件）`,
                `⭐⭐⭐⭐　 （${stats.starCounts['4']}件）`,
                `⭐⭐⭐　　 （${stats.starCounts['3']}件）`,
                `⭐⭐　　　 （${stats.starCounts['2']}件）`,
                `⭐　　　　 （${stats.starCounts['1']}件）`,
              ].join('\n'),
              inline: true,
            },
            { name: '総コメント数', value: `💬 ${stats.commentCount}件`, inline: true }
          )
          .setColor(0xffd700)
          .setFooter({ text: `区分: ${stats.type}` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`${CID.BTN_COMMENT_VIEW}:${targetUserId}`)
            .setLabel('コメント確認')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(stats.commentCount === 0)
        );

        await interaction.editReply({
          content: null,
          embeds: [embed],
          components: [row],
        });
      },
    });
  },

  /**
   * コメント一覧を表示
   */
  async showComments(interaction, targetUserId) {
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.REPLY,
      async run(interaction) {
        const guildId = interaction.guildId;
        const stats = await aggregateUserRatings(guildId, targetUserId);

        const targetUser = await interaction.guild.members
          .fetch(targetUserId)
          .catch(() => ({ displayName: targetUserId }));

        const embed = new EmbedBuilder()
          .setTitle(`💬 口コミコメント履歴: ${targetUser.displayName}`)
          .setColor(0x3498db);

        if (stats.comments.length === 0) {
          embed.setDescription('寄せられたコメントはありません。');
        } else {
          const lines = stats.comments.slice(0, 10).map((c) => {
            const stars = c.stars ? '⭐'.repeat(c.stars) : '💬';
            const date = c.date.split('T')[0];
            return `**${stars}** (by <@${c.raterId}>) \`${date}\`\n   ┗ "${c.text}"`;
          });
          embed.setDescription(lines.join('\n\n'));
          if (stats.comments.length > 10) {
            embed.setFooter({ text: `他 ${stats.comments.length - 10} 件のコメントがあります` });
          }
        }

        await interaction.editReply({ embeds: [embed] });
      },
    });
  },
};
