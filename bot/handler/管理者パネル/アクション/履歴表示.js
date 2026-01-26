// handler/管理者パネル/アクション/履歴表示.js

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { ButtonBuilder, ButtonStyle } = require('discord.js');
const { loadConfig } = require('../../../utils/設定/設定マネージャ');

/**
 * 履歴・評価表示ハンドラー
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const sub = parsed?.params?.sub || 'start';

    // 全てのルートを autoInteractionTemplate で保護
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: sub === 'detail' ? ACK.NONE : ACK.AUTO, // モーダルの場合は ACK なし
      panelKey: 'rideListPanel',
      async run(interaction) {
        if (sub === 'recent') return showRecentHistory(interaction, client, parsed);
        if (sub === 'rating') return showRatingList(interaction, client, parsed);
        if (sub === 'audit') return showAuditLogs(interaction, client, parsed);
        if (sub === 'detail') return showHistorySearchModal(interaction);
        if (sub === 'search_execute') return handleHistorySearch(interaction, client, parsed);

        // legacy compatibility
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
            .setLabel('📅 詳細履歴検索 (期間指定)')
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
 * 履歴検索モーダルを表示
 */
async function showHistorySearchModal(interaction) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

  const modal = new ModalBuilder()
    .setCustomId('adm|history|sub=search_execute')
    .setTitle('送迎履歴 詳細検索');

  const startInput = new TextInputBuilder()
    .setCustomId('search|start')
    .setLabel('開始日 (例: 26/01/01 或いは 01/01)')
    .setPlaceholder('YY/MM/DD 形式で入力してください')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  const endInput = new TextInputBuilder()
    .setCustomId('search|end')
    .setLabel('終了日 (例: 26/01/25 或いは 01/25)')
    .setPlaceholder('空欄の場合は開始日当日のみ検索します')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(startInput),
    new ActionRowBuilder().addComponents(endInput)
  );

  return interaction.showModal(modal);
}

/**
 * 期間指定検索の実行
 */
async function handleHistorySearch(interaction, client, parsed) {
  const rawStart = interaction.fields.getTextInputValue('search|start')?.trim();
  const rawEnd = interaction.fields.getTextInputValue('search|end')?.trim() || rawStart;

  const parseDate = (str) => {
    if (!str) return null;
    let parts = str.split('/').map(p => parseInt(p, 10));
    const now = new Date();
    let y, m, d;

    if (parts.length === 3) {
      // YY/MM/DD
      y = parts[0] < 100 ? 2000 + parts[0] : parts[0];
      m = parts[1];
      d = parts[2];
    } else if (parts.length === 2) {
      // MM/DD (今年と仮定)
      y = now.getFullYear();
      m = parts[0];
      d = parts[1];
    } else {
      return null;
    }
    const date = new Date(y, m - 1, d, 0, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  };

  const startDate = parseDate(rawStart);
  const endDate = parseDate(rawEnd);

  if (!startDate || !endDate) {
    return interaction.reply({ content: '⚠️ 日付形式が正しくありません。(例: 26/01/01)', flags: 64 });
  }

  if (startDate > endDate) {
    return interaction.reply({ content: '⚠️ 開始日は終了日より前の日付を指定してください。', flags: 64 });
  }

  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId;
  const config = await loadConfig(guildId).catch(() => ({}));
  const userRanks = config.ranks?.userRanks || {};

  // 検索対象の月フォルダを特定
  const targetMonths = [];
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (current <= endDate) {
    targetMonths.push({ y: current.getFullYear(), m: current.getMonth() + 1 });
    current.setMonth(current.getMonth() + 1);
  }

  const allRecords = [];
  for (const { y, m } of targetMonths) {
    const dir = paths.dispatchHistoryDir(guildId, y, m);
    const files = await store.listKeys(dir).catch(() => []);
    for (const fileKey of files) {
      if (!fileKey.endsWith('.json')) continue;
      const data = await store.readJson(fileKey).catch(() => null);
      if (data) {
        const cDate = new Date(data.createdAt || data.matchAt || Date.now());
        // 00:00:00 に正規化して比較
        const compareDate = new Date(cDate.getFullYear(), cDate.getMonth(), cDate.getDate());
        if (compareDate >= startDate && compareDate <= endDate) {
          allRecords.push(data);
        }
      }
    }
  }

  allRecords.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const buildPanelEmbed = require('../../../utils/embed/embedTemplate');

  if (allRecords.length === 0) {
    const embed = buildPanelEmbed({
      title: `📅 送迎履歴検索結果`,
      description: [
        `**検索対象**: ${startDate.toLocaleDateString('ja-JP')} ～ ${endDate.toLocaleDateString('ja-JP')}`,
        '',
        '該当する走行データは見つかりませんでした。',
      ].join('\n'),
      color: 0x95a5a6,
      client: interaction.client
    });
    return interaction.editReply({ embeds: [embed] });
  } else {
    let totalPassengers = 0;
    const lines = [];

    // 表示件数制限 (Discord制限を考慮)
    const displayRecords = allRecords.slice(-15);

    displayRecords.forEach((r) => {
      const time = r.createdAt ? new Date(r.createdAt).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }) + ' ' +
        new Date(r.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';

      const carpoolCount = (r.carpoolUsers || []).reduce((sum, u) => sum + (u.count || 1), 0);
      const guestCount = r.guest ? 1 : 0;
      const mainCount = r.userId ? 1 : 0;
      const total = mainCount + guestCount + carpoolCount;

      totalPassengers += total;

      const dRank = userRanks[r.driverId] ? `[${userRanks[r.driverId]}] ` : '';
      const pId = r.userId || r.passengerId;
      const pMention = pId ? `<@${pId}>` : (r.guest ? 'ゲスト' : '不明');

      lines.push(`▫️ \`${time}\` ${dRank}<@${r.driverId}> ➔ ${pMention} (${total}名)\n> 🗺️ ${r.direction || '詳細不明'}`);
    });

    const embed = buildPanelEmbed({
      title: `📅 送迎履歴詳細レポート`,
      description: [
        `**対象範囲**: ${startDate.toLocaleDateString('ja-JP')} ～ ${endDate.toLocaleDateString('ja-JP')}`,
        '',
        allRecords.length > 15 ? `⚠️ **注意**: 最新の 15 件のみ表示しています。` : '',
        '',
        ...lines
      ].join('\n'),
      fields: [
        {
          name: '📊 期間内統計', value: [
            `▫️ 総走行回数: **${allRecords.length}** 回`,
            `▫️ 合計利用者: **${totalPassengers}** 名`,
          ].join('\n'), inline: false
        }
      ],
      color: 0x3498db,
      client: interaction.client
    });
    return interaction.editReply({ embeds: [embed] });
  }
}

/**
 * 直近10件の履歴を表示 (v1.8.0)
 */
async function showRecentHistory(interaction, client, parsed) {
  const guildId = interaction.guildId;
  const config = await loadConfig(guildId).catch(() => ({}));
  const userRanks = config.ranks?.userRanks || {};
  const currentMonth = new Date().getMonth() + 1;
  const historyDir = paths.dispatchHistoryDir(guildId, new Date().getFullYear(), currentMonth);

  const files = await store.listKeys(historyDir).catch(() => []);
  const jsonFiles = files
    .filter((f) => f.endsWith('.json'))
    .slice(-10)
    .reverse();

  if (jsonFiles.length === 0) {
    const embed = buildPanelEmbed({
      title: '🕒 最新運行状況 (10件)',
      description: '今月の運行データはまだ記録されていません。',
      color: 0x95a5a6,
      client: interaction.client
    });
    return interaction.editReply({ embeds: [embed] });
  } else {
    const lines = [];
    for (const fileKey of jsonFiles) {
      const data = await store.readJson(fileKey).catch(() => null);
      if (data) {
        const time = data.createdAt ? new Date(data.createdAt).toLocaleTimeString('ja-JP', {
          hour: '2-digit', minute: '2-digit'
        }) : '--:--';

        const statusIcon = (data.status === 'completed' || data.status === 'finished') ? '✅' : '🚨';
        const dRank = userRanks[data.driverId] ? `[${userRanks[data.driverId]}] ` : '';
        const pId = data.userId || data.passengerId;
        const pMention = pId ? `<@${pId}>` : (data.guest ? 'ゲスト' : '不明');

        lines.push(`${statusIcon} \`${time}\` ${dRank}<@${data.driverId}> ➔ ${pMention}\n> 📍 ${data.direction || '詳細不明'}`);
      }
    }

    const embed = buildPanelEmbed({
      title: '🕒 最新運行状況 (直近10件)',
      description: lines.join('\n\n'),
      color: 0x3498db,
      client: interaction.client
    });
    return interaction.editReply({ embeds: [embed] });
  }
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
  const config = await loadConfig(guildId).catch(() => ({}));
  const userRanks = config.ranks?.userRanks || {};
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
      const matchT = r.matchTime || (r.createdAt ? new Date(r.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--');
      const startT = r.startTime !== '--:--' ? r.startTime : null;
      const endT = r.endTime !== '--:--' ? r.endTime : (r.status === 'COMPLETED' || r.status === 'finished' ? '終了' : '運行中');
      const rideTimeStr = startT ? ` [実車: ${startT}～${endT}]` : '';

      const carpoolCount = r.carpoolUsers ? r.carpoolUsers.reduce((sum, u) => sum + (u.count || 1), 0) : 0;
      const count = (r.count || 1) + carpoolCount;
      totalPassengers += count;

      const carpoolStr = carpoolCount > 0 ? ` (+相乗り${carpoolCount}名)` : '';
      const dRank = userRanks[r.driverId] ? `[${userRanks[r.driverId]}] ` : '';
      const pRank = userRanks[r.passengerId] ? ` [${userRanks[r.passengerId]}]` : '';

      return `${statusIcon} \`${matchT}\`${rideTimeStr} ${dRank}<@${r.driverId}> ➔ <@${r.passengerId}>${pRank}${carpoolStr}\n> 🗺️ ${r.route || r.direction || '不明'} (${count}名)`;
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
  const config = await loadConfig(guildId).catch(() => ({}));
  const userRanks = config.ranks?.userRanks || {};
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

  if (recentFiles.length === 0) {
    const embed = buildPanelEmbed({
      title: '⭐ 最新評価フィードバック',
      description: '口コミデータはまだ投稿されていません。',
      color: 0x95a5a6,
      client: interaction.client
    });
    return interaction.editReply({ embeds: [embed] });
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
          const rank = userRanks[targetId] ? ` [${userRanks[targetId]}]` : '';
          targetDisplay = `<@${targetId}>${rank}`;
        }

        lines.push(`**${item.type}評** ${targetDisplay} ➔ ${stars}${comment}`);
      }
    }

    const embed = buildPanelEmbed({
      title: '⭐ 最新評価フィードバック (最新10件)',
      description: lines.join('\n\n'),
      color: 0xffd700,
      client: interaction.client
    });
    return interaction.editReply({ embeds: [embed] });
  }
}

/**
 * システム監査ログの表示 (v1.8.0)
 */
async function showAuditLogs(interaction, client, parsed) {
  const { findAuditLogs } = require('../../../utils/ストレージ/監査ログストア');
  const guildId = interaction.guildId;

  const logs = await findAuditLogs(guildId, { limit: 12 }).catch(() => []);

  if (logs.length === 0) {
    const embed = buildPanelEmbed({
      title: '📜 システム動作ログ',
      description: '監査対象の動作ログは見つかりませんでした。',
      color: 0x95a5a6,
      client: interaction.client
    });
    return interaction.editReply({ embeds: [embed] });
  } else {
    const lines = logs.map((log) => {
      const time = log.time ? new Date(log.time).toLocaleTimeString('ja-JP', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }) : '--:--';
      const severity = log.severity === 'ERROR' ? '❌' : (log.severity === 'WARN' ? '⚠️' : 'ℹ️');
      const actorInfo = log.actor ? `(by <@${log.actor}>)` : '';

      return `${severity} \`${time}\` **[${log.tag}]** ${log.message} ${actorInfo}`;
    });

    const embed = buildPanelEmbed({
      title: '📜 システム動作ログ',
      description: lines.join('\n'),
      color: 0x34495e,
      client: interaction.client,
      footer: '最新12件を表示中 ｜ 管理監査システム'
    });
    return interaction.editReply({ embeds: [embed] });
  }
}
