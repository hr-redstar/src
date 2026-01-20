const {
  UserSelectMenuBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { aggregateUserRatings } = require('./集計ロジック');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../../utils/embed/panelMessageTemplate');

const CID = {
  BTN_RATING_CHECK: 'adm|rating_check|sub=start',
  SEL_USER: 'adm|rating_check|sub=user_sel',
  BTN_COMMENT_VIEW: 'adm|rating_check|sub=comments', // did が続く想定
};

module.exports = {
  CID,

  /**
   * ボタン押下：ユーザー選択を表示
   */
  async startFlow(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.REPLY,
      async run(interaction) {
        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(CID.SEL_USER)
            .setPlaceholder('評価を確認するユーザーを選択してください')
        );
        await interaction.editReply({
          content: '👤 評価を確認したいユーザーを選択してください。',
          components: [row],
        });
      },
    });
  },

  /**
   * ユーザー選択後：統計Embedを表示
   */
  async showStats(interaction, client, parsed) {
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
        const starLine = '⭐'.repeat(fullStars) + (stats.average % 1 >= 0.5 ? '🌓' : '　');

        const embed = buildPanelEmbed({
          title: `📊 口コミ・評価統計: ${targetUser.displayName}`,
          description: `
**総合評価**: **${stats.average}** ${starLine} (${stats.totalCount}件)

**評価内訳**
\`\`\`
⭐⭐⭐⭐⭐ （${stats.starCounts['5']}件）
⭐⭐⭐⭐　 （${stats.starCounts['4']}件）
⭐⭐⭐　　 （${stats.starCounts['3']}件）
⭐⭐　　　 （${stats.starCounts['2']}件）
⭐　　　　 （${stats.starCounts['1']}件）
\`\`\`
💬 **総コメント数**: ${stats.commentCount}件
          `,
          color: 0xffd700,
          client: interaction.client
        });

        if (targetUser.user?.displayAvatarURL) {
          embed.setThumbnail(targetUser.user.displayAvatarURL());
        }
        embed.setFooter({ text: `区分: ${stats.type}` });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`${CID.BTN_COMMENT_VIEW}&uid=${targetUserId}&page=0`)
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
  async showComments(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.REPLY,
      async run(interaction) {
        const targetUserId = parsed.params.uid;
        const page = parseInt(parsed.params.page || 0);
        const guildId = interaction.guildId;
        const stats = await aggregateUserRatings(guildId, targetUserId);
        const pageSize = 5;
        const start = page * pageSize;
        const end = start + pageSize;
        const comments = stats.comments.slice(start, end);
        const totalPages = Math.ceil(stats.comments.length / pageSize);

        const targetUser = await interaction.guild.members
          .fetch(targetUserId)
          .catch(() => ({ displayName: targetUserId }));

        const embed = buildPanelEmbed({
          title: `💬 口コミコメント履歴: ${targetUser.displayName}`,
          description: `ページ: ${page + 1} / ${totalPages}`,
          color: 0x3498db,
          client: interaction.client
        });

        if (comments.length === 0) {
          embed.setDescription('寄せられたコメントはありません。');
        } else {
          const lines = comments.map((c) => {
            const stars = c.stars ? '⭐'.repeat(c.stars) : '💬';
            const date = c.date ? c.date.split('T')[0] : '不明';
            return `**${stars}** (by <@${c.raterId}>) \`${date}\`\n> "${c.text}"`;
          });
          embed.setDescription(`ページ: ${page + 1} / ${totalPages}\n\n${lines.join('\n\n')}`);
        }

        const buttons = new ActionRowBuilder();
        if (page > 0) {
          buttons.addComponents(
            new ButtonBuilder()
              .setCustomId(`${CID.BTN_COMMENT_VIEW}&uid=${targetUserId}&page=${page - 1}`)
              .setLabel('◀️ 前へ')
              .setStyle(ButtonStyle.Secondary)
          );
        }
        if (end < stats.comments.length) {
          buttons.addComponents(
            new ButtonBuilder()
              .setCustomId(`${CID.BTN_COMMENT_VIEW}&uid=${targetUserId}&page=${page + 1}`)
              .setLabel('次へ ▶️')
              .setStyle(ButtonStyle.Secondary)
          );
        }

        const components = buttons.components.length > 0 ? [buttons] : [];

        // 既に返信済み（ページ切り替え）なら editReply, 初回なら reply
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ embeds: [embed], components });
        } else {
          await interaction.editReply({ embeds: [embed], components });
        }
      },
    });
  },
};
