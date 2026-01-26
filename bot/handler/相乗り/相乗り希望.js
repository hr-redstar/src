// handler/相乗り/相乗り希望.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = {
  execute: async function (interaction, client, parsed) {
    // carpool|join|rid={rideId}
    const rideId = parsed?.params?.rid;

    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      async run(interaction) {
        const sub = parsed?.params?.sub || 'direction';
        const rideId = parsed?.params?.r || parsed?.params?.rid;
        const dir = parsed?.params?.d || parsed?.params?.dir;

        if (sub === 'direction') {
          return showDirectionSelection(interaction, rideId);
        }
        if (sub === 'dest_input') {
          return showDestInput(interaction, rideId, dir);
        }
        if (sub === 'dest_modal_trigger') {
          return handleDestModalTrigger(interaction, rideId, dir);
        }
        if (sub === 'segment_select' || sub === 'ss') {
          return showSegmentSelection(interaction, parsed);
        }
      },
    });
  },
};

/**
 * 送迎者用: 区間選択ボタン表示
 */
async function showSegmentSelection(interaction, parsed) {
  const rideId = parsed?.params?.r || parsed?.params?.rid;
  const userId = parsed?.params?.u || parsed?.params?.uid;

  const store = require('../../utils/ストレージ/ストア共通');
  const paths = require('../../utils/ストレージ/ストレージパス');

  // rideId が timestamp_userId_guildId 形式ならそこから抽出
  const guildIdFromRideId = rideId?.split('_')?.[2];
  const guildId = interaction.guildId || parsed?.params?.gid || guildIdFromRideId;

  const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
  const rideData = await store.readJson(activePath).catch(() => null);

  if (!rideData) return interaction.editReply('⚠️ 元の送迎データが見つかりません。');

  // 保留中のリクエストからデータを取得
  const request = rideData.pendingCarpoolRequests?.[userId];
  if (!request) return interaction.editReply('⚠️ 相乗りリクエストの有効期限が切れたか、見つかりません。');

  const { direction, location, count } = request;

  const embed = buildPanelEmbed({
    title: '🤝 相乗り区間の選択',
    description: [
      `👤 希望者: <@${userId}> (${count}名)`,
      `📍 目的地: **${direction} / ${location}**`,
      '',
      '現在設定されているルートのどの区間から乗車を開始しますか？'
    ].join('\n'),
    type: 'info',
    client: interaction.client
  });

  const loc1 = rideData.driverPlace || '現在地';
  const loc2 = rideData.mark || '不明';
  const loc3 = rideData.destination || '不明';
  const loc4 = `${direction} / ${location}`;

  const gidSuffix = rideId.split('_').length < 3 ? `&gid=${guildId}` : '';
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`carpool|approve|r=${rideId}&u=${userId}&seg=1${gidSuffix}`)
      .setLabel(`【${loc1}】→【${loc2}】`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`carpool|approve|r=${rideId}&u=${userId}&seg=2${gidSuffix}`)
      .setLabel(`【${loc2}】→【${loc3}】`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`carpool|approve|r=${rideId}&u=${userId}&seg=3${gidSuffix}`)
      .setLabel(`【${loc3}】→【${loc4}】`)
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * STEP 1: 方面選択
 */
async function showDirectionSelection(interaction, rideId) {
  const store = require('../../utils/ストレージ/ストア共通');
  const paths = require('../../utils/ストレージ/ストレージパス');
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');

  // 運営設定から方面リストを読み込む
  const dirListPath = paths.directionsListJson(interaction.guildId);
  const directionsList = await store.readJson(dirListPath, []).catch(() => []);

  // 有効な方面のみを抽出
  const directions = directionsList
    .filter((d) => d.enabled !== false)
    .map((d) => d.name.replace(/【|】/g, ''));

  // 利用者登録チェック (v2.9.2)
  const { loadUserFull } = require('../../utils/usersStore');
  const fullData = await loadUserFull(interaction.guildId, interaction.user.id).catch(() => null);

  if (!fullData || (!fullData.current && !fullData.nickname)) {
    const { loadConfig } = require('../../utils/設定/設定マネージャ');
    const config = await loadConfig(interaction.guildId);
    const regChannelId = config.panels?.userRegister?.channelId;
    const regLink = regChannelId ? `\n👉 <#${regChannelId}> から登録を行ってください。` : '\n管理者へお問い合わせください。';

    const errorEmbed = buildPanelEmbed({
      title: '⚠️ 利用者登録が必要です',
      description: `相乗り希望を出すには、先に利用者登録を完了する必要があります。${regLink}`,
      type: 'danger',
      client: interaction.client
    });
    return interaction.editReply({ embeds: [errorEmbed], components: [] });
  }

  const embed = buildPanelEmbed({
    title: '🤝 相乗り希望 - 方面選択',
    description: 'まずは合流地点または目的地の方面を選択してください。',
    color: 0x3498db,
    client: interaction.client
  });

  const rows = [];
  let currentRow = new ActionRowBuilder();

  if (directions.length === 0) {
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`carpool|join|sub=dest_input&rid=${rideId}&dir=指定なし`)
        .setLabel('指定なし')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(currentRow);
  } else {
    directions.forEach((d, index) => {
      if (index > 0 && index % 5 === 0) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
      currentRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`carpool|join|sub=dest_input&rid=${rideId}&dir=${d}`)
          .setLabel(d.substring(0, 20))
          .setStyle(ButtonStyle.Primary)
      );
    });
    rows.push(currentRow);
  }

  await interaction.editReply({ embeds: [embed], components: rows });
}

/**
 * STEP 2: 目的地入力ボタン
 */
async function showDestInput(interaction, rideId, direction) {
  const buildPanelEmbed = require('../../utils/embed/embedTemplate');
  const embed = buildPanelEmbed({
    title: '🤝 相乗り希望 - 目的地入力',
    description: [
      `選択された方面: **${direction}**`,
      '',
      '具体的な目的地（合流場所）がわかる場合は詳細を入力してください。',
      '※入力が難しい場合は「スキップ」して次へ進めます。'
    ].join('\n'),
    color: 0x3498db,
    client: interaction.client
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`carpool|join|sub=dest_modal_trigger&rid=${rideId}&dir=${direction}`)
      .setLabel('🎯 目的地を入力する')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`carpool|join|sub=dest_modal_trigger&rid=${rideId}&dir=${direction}&dest=`)
      .setLabel('スキップして次へ')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * STEP 2.5: 目的地モーダル表示
 */
/**
 * STEP 2.5: 目的地モーダル表示 または 自動送信 (v2.9.2)
 */
async function handleDestModalTrigger(interaction, rideId, direction) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

  // スキップして次へ (dest= が存在する場合)
  const isSkip = interaction.customId?.includes('dest=');

  if (isSkip) {
    const { loadUser } = require('../../utils/usersStore');
    const { sendCarpoolRequestToDriver } = require('./carpoolNotifyDriver');

    await interaction.deferUpdate();

    // 利用者プロフィールの取得
    const profile = await loadUser(interaction.guildId, interaction.user.id);
    const location = profile?.mark || profile?.landmark || profile?.address || '(登録情報なし)';
    const count = 1; // スキップ時はデフォルト 1名

    try {
      await sendCarpoolRequestToDriver({
        guild: interaction.guild,
        client: interaction.client,
        rideId,
        direction,
        location,
        userId: interaction.user.id,
        count
      });

      await interaction.followUp({
        content: `✅ 登録情報を利用してドライバーに相乗りリクエストを送信しました。\n📍 目的地: **${location}**\n承認されるまでしばらくお待ちください。`,
        flags: 64
      });
    } catch (e) {
      console.error('相乗りオートリクエスト送信失敗', e);
      await interaction.followUp({
        content: `❌ ${e.message || 'ドライバーへのリクエスト送信に失敗しました。'}`,
        flags: 64
      });
    }
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`carpool|join|sub=modal&rid=${rideId}&dir=${direction}`)
    .setTitle('目的地・場所入力');

  const destInp = new TextInputBuilder()
    .setCustomId('input|carpool|location')
    .setLabel('具体的な目的地・場所 (任意)')
    .setPlaceholder('例: 〇〇ホテル、△△交差点')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  // ここで人数も一緒に聞くか、分けるか。仕様では「人数：」も入力。
  const countInp = new TextInputBuilder()
    .setCustomId('input|carpool|count')
    .setLabel('乗車人数')
    .setStyle(TextInputStyle.Short)
    .setValue('1')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(destInp),
    new ActionRowBuilder().addComponents(countInp)
  );

  await interaction.showModal(modal);
}
