// handler/管理者パネル/アクション/履歴表示.js

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
const { ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * 履歴・評価表示ハンドラー
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const sub = parsed?.params?.sub || 'start';

    // 全てのルートを autoInteractionTemplate で保護
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.AUTO,
      async run(interaction) {
        if (sub === 'recent') return showRecentHistory(interaction, client, parsed);
        if (sub === 'rating') return showRatingList(interaction, client, parsed);
        if (sub === 'audit') return showAuditLogs(interaction, client, parsed);
        if (sub === 'detail') return showHistoryMonthSelect(interaction, client, parsed);
        if (sub === 'month_sel') return showHistoryDaySelect(interaction, client, parsed);
        if (sub === 'day_sel') return showHistoryResult(interaction, client, parsed);

        // デフォルト（sub=start）
        const embed = buildPanelEmbed({
          title: '📜 送迎履歴・システムログ',
          description: '表示したい履歴・ログの種類を選択してください。',
          color: 0x3498db,
          client: interaction.client
        });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('adm|history|sub=recent')
            .setLabel('🕒 最近の配車履歴')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('adm|history|sub=rating')
            .setLabel('⭐ 口コミ・評価一覧')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('adm|history|sub=audit')
            .setLabel('📜 システムログ')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('adm|history|sub=detail')
            .setLabel('📅 月別履歴検索')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({
          embeds: [embed],
          components: [row],
        });
      },
    });
  },
};

/**
 * 直近10件の履歴を表示 (v1.8.0)
 */
async function showRecentHistory(interaction, client, parsed) {
  const guildId = interaction.guildId;
  const now = new Date();
  const historyDir = paths.dispatchHistoryDir(guildId, now.getFullYear(), now.getMonth() + 1);

  const files = await store.listKeys(historyDir).catch(() => []);
  const jsonFiles = files
    .filter((f) => f.endsWith('.json'))
    .slice(-10)
    .reverse();

  const embed = buildPanelEmbed({
    title: '🕒 最近の配車履歴 (最新10件)',
    color: 0x3498db,
    client: interaction.client
  });

  if (jsonFiles.length === 0) {
    embed.setDescription('最近の履歴データは見つかりません。');
  } else {
    const lines = [];
    for (const fileKey of jsonFiles) {
      const data = await store.readJson(fileKey).catch(() => null);
      if (data) {
        const time = data.createdAt ? new Date(data.createdAt).toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit',
        }) : '--:--';

        const statusIcon = data.status === 'completed' ? '✅' : '🚨';
        lines.push(
          `${statusIcon} \`${time}\` <@${data.driverId}> ➔ <@${data.passengerId}>\n> 🗺️ ${data.direction || '詳細不明'}`
        );
      }
    }
    embed.setDescription(lines.join('\n\n') || '有効な履歴データが読み込めませんでした。');
  }
  return interaction.editReply({ embeds: [embed] });
}

/**
 * 月選択の表示
 */
async function showHistoryMonthSelect(interaction, client, parsed) {
  const now = new Date();
  const options = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    options.push({ label: `${y}年${m}月`, value: `${y}-${m}` });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('adm|history|sub=month_sel')
    .setPlaceholder('年月を選択してください')
    .addOptions(options);

  const embed = buildPanelEmbed({
    title: '📅 履歴検索 (年月選択)',
    description: '履歴を確認したい **年月** を選択してください。',
    color: 0x3498db,
    client: interaction.client
  });

  const row = new ActionRowBuilder().addComponents(select);
  return interaction.editReply({
    embeds: [embed],
    components: [row],
  });
}

/**
 * 日選択の表示
 */
async function showHistoryDaySelect(interaction, client, parsed) {
  const [y, m] = interaction.values[0].split('-');
  const guildId = interaction.guildId;

  const options = [];
  for (let d = 1; d <= 31; d++) {
    options.push({ label: `${d}日`, value: `${y}-${m}-${d}` });
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('adm|history|sub=day_sel')
    .setPlaceholder('日付を選択してください')
    .addOptions(options.slice(0, 25)); // Discord制限

  const embed = buildPanelEmbed({
    title: `📅 履歴検索 (${y}年${m}月)`,
    description: `**${y}年${m}月** のどの日付を確認しますか？`,
    color: 0x3498db,
    client: interaction.client
  });

  const row = new ActionRowBuilder().addComponents(select);
  await interaction.editReply({
    embeds: [embed],
    components: [row],
  });
}

/**
 * 指定日の結果を表示 (v1.8.0)
 */
async function showHistoryResult(interaction, client, parsed) {
  const [y, m, d] = interaction.values[0].split('-');
  const guildId = interaction.guildId;
  const historyDir = paths.dispatchHistoryDir(guildId, parseInt(y), parseInt(m));

  const allFiles = await store.listKeys(historyDir).catch(() => []);
  const results = [];
  for (const fileKey of allFiles) {
    if (!fileKey.endsWith('.json')) continue;
    const data = await store.readJson(fileKey).catch(() => null);
    if (data) {
      const cDate = new Date(data.createdAt);
      if (cDate.getFullYear() == y && cDate.getMonth() + 1 == m && cDate.getDate() == d) {
        results.push(data);
      }
    }
  }

  const embed = buildPanelEmbed({
    title: `📅 送迎履歴: ${y}/${m}/${d}`,
    color: 0x2ecc71, // Green
    client: interaction.client
  });

  if (results.length === 0) {
    embed.setDescription('指定された日の履歴はありません。').setColor(0x95a5a6);
  } else {
    results.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    let totalPassengers = 0;
    const lines = results.map((r) => {
      const startTime = r.createdAt ? new Date(r.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const endTime = r.completedAt ? new Date(r.completedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '運行中';
      const statusIcon = r.status === 'completed' ? '✅' : (r.status === 'matched' || r.status === 'in-progress' ? '🚕' : '🚨');

      const carpoolCount = r.carpoolUsers ? r.carpoolUsers.reduce((sum, u) => sum + (u.count || 1), 0) : 0;
      const count = (r.count || 1) + carpoolCount;
      totalPassengers += count;

      const carpoolStr = carpoolCount > 0 ? ` (+相乗り${carpoolCount}名)` : '';

      return `${statusIcon} \`${startTime}-${endTime}\` <@${r.driverId}> ➔ <@${r.passengerId}>${carpoolStr}\n> 🗺️ ${r.route || r.direction || '不明'} (${count}名)`;
    });

    embed.setDescription(lines.join('\n\n'));
    embed.addFields({
      name: '📊 日計統計',
      value: `▫️ 総走行件数: **${results.length}** 件\n▫️ 合計利用者: **${totalPassengers}** 名`,
      inline: false
    });
  }

  await interaction.editReply({ embeds: [embed], components: [] });
}

/**
 * 最近の評価一覧を表示 (v1.8.0)
 */
async function showRatingList(interaction, client, parsed) {
  const guildId = interaction.guildId;
  const driverRatingDir = `${paths.ratingLogsDir(guildId)}/送迎者`;
  const userRatingDir = `${paths.ratingLogsDir(guildId)}/利用者`;

  const [driverFiles, userFiles] = await Promise.all([
    store.listKeys(driverRatingDir).catch(() => []),
    store.listKeys(userRatingDir).catch(() => []),
  ]);

  const allFiles = [
    ...driverFiles.filter((f) => f.endsWith('.json')).map((f) => ({ path: f, type: '送迎者' })),
    ...userFiles.filter((f) => f.endsWith('.json')).map((f) => ({ path: f, type: '利用者' })),
  ];

  allFiles.sort((a, b) => b.path.localeCompare(a.path));
  const recentFiles = allFiles.slice(0, 10);

  const embed = buildPanelEmbed({
    title: '⭐ 最近の口コミ・評価 (最新10件)',
    color: 0xffd700,
    client: interaction.client
  });

  if (recentFiles.length === 0) {
    embed.setDescription('評価データが見つかりません。');
  } else {
    const lines = [];
    for (const item of recentFiles) {
      const data = await store.readJson(item.path).catch(() => null);
      if (data && data.current) {
        const stars = data.current.stars ? '⭐'.repeat(data.current.stars) : '💬';
        const comment = data.current.comment ? `\n> 「${data.current.comment}」` : '';
        let targetDisplay = '不明';
        const dispatchId = item.path.split('/').pop().replace('.json', '');

        // 履歴から対象者を特定
        const now = new Date();
        const historyDir = paths.dispatchHistoryDir(guildId, now.getFullYear(), now.getMonth() + 1);
        const dispatchData = await store.readJson(`${historyDir}/${dispatchId}.json`).catch(() => null);

        if (dispatchData) {
          const targetId = item.type === '送迎者' ? dispatchData.driverId : dispatchData.passengerId;
          targetDisplay = `<@${targetId}>`;
        }

        lines.push(
          `**${item.type}評** ${targetDisplay} へ ${stars}\n▫️ 投稿者: <@${data.raterId}>${comment}`
        );
      }
    }
    embed.setDescription(lines.join('\n\n') || '評価データが読み込めませんでした。');
  }
  return interaction.editReply({ embeds: [embed], components: [] });
}

/**
 * システム監査ログの表示 (v1.8.0)
 */
async function showAuditLogs(interaction, client, parsed) {
  const { findAuditLogs } = require('../../../utils/ストレージ/監査ログストア');
  const guildId = interaction.guildId;

  const logs = await findAuditLogs(guildId, { limit: 12 }).catch(() => []);

  const embed = buildPanelEmbed({
    title: '📜 システム監査ログ',
    color: 0x95a5a6, // Gray
    client: interaction.client
  });

  if (logs.length === 0) {
    embed.setDescription('監査ログは見つかりませんでした。');
  } else {
    const lines = logs.map((log) => {
      const time = log.time ? new Date(log.time).toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) : '--:--';
      const severity =
        log.severity === 'ERROR' ? '❌' : log.severity === 'WARN' ? '⚠️' : '▫️';
      const actorInfo = log.actor ? `(by <@${log.actor}>)` : '';

      return `${severity} \`${time}\` **[${log.tag}]** ${log.message} ${actorInfo}`;
    });
    embed.setDescription(lines.join('\n'));
    embed.setFooter({ text: '最新12件を表示中 ｜ 管理監査用' });
  }

  return interaction.editReply({ embeds: [embed], components: [] });
}
