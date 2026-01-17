// handler/相乗り/相乗り希望.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = {
  execute: async function (interaction, parsed) {
    // carpool|join|rid={rideId}
    const rideId = parsed?.params?.rid;

    return autoInteractionTemplate(interaction, {
      ack: ACK.AUTO,
      async run(interaction) {
        const sub = parsed?.params?.sub || 'direction';
        const rideId = parsed?.params?.rid;
        const dir = parsed?.params?.dir;

        if (sub === 'direction') {
          return showDirectionSelection(interaction, rideId);
        }
        if (sub === 'dest_input') {
          return showDestInput(interaction, rideId, dir);
        }
        if (sub === 'dest_modal_trigger') {
          return handleDestModalTrigger(interaction, rideId, dir);
        }
        if (sub === 'segment_select') {
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
  const { rid: rideId, uid: userId, cnt: count, dir: direction, dest: location } = parsed.params;
  const store = require('../../utils/ストレージ/ストア共通');
  const paths = require('../../utils/ストレージ/ストレージパス');
  const activePath = `${paths.activeDispatchDir(interaction.guildId)}/${rideId}.json`;
  const rideData = await store.readJson(activePath).catch(() => null);

  if (!rideData) return interaction.editReply('⚠️ 元の送迎データが見つかりません。');

  const embed = new EmbedBuilder()
    .setTitle('🤝 相乗り区間の選択')
    .setDescription(
      `相乗り希望者: <@${userId}> (${count}名)\n目的地: **${direction} / ${location}**\n\n現在のルートのどの区間で乗車しますか？`
    )
    .setColor(0x3498db);

  const loc1 = rideData.driverPlace || '現在地';
  const loc2 = rideData.mark || '不明';
  const loc3 = rideData.destination;
  const loc4 = `${direction} / ${location}`;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`carpool|approve|rid=${rideId}&uid=${userId}&cnt=${count}&seg=1&loc=${loc4}`)
      .setLabel(`【${loc1}】→【${loc2}】`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`carpool|approve|rid=${rideId}&uid=${userId}&cnt=${count}&seg=2&loc=${loc4}`)
      .setLabel(`【${loc2}】→【${loc3}】`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`carpool|approve|rid=${rideId}&uid=${userId}&cnt=${count}&seg=3&loc=${loc4}`)
      .setLabel(`【${loc3}】→【${loc4}】`)
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * STEP 1: 方面選択
 */
async function showDirectionSelection(interaction, rideId) {
  const { loadConfig } = require('../../utils/設定/設定マネージャ');
  const config = await loadConfig(interaction.guildId);
  const directions = config.directions || ['立川方面', '八王子市内', '相模原方面', 'その他'];

  const embed = new EmbedBuilder()
    .setTitle('📢 相乗り希望 - 方面選択')
    .setDescription('合流地点または目的地の方面を選択してください。')
    .setColor(0x3498db);

  const rows = [];
  let currentRow = new ActionRowBuilder();

  directions.forEach((d, index) => {
    if (index > 0 && index % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`carpool|join|sub=dest_input&rid=${rideId}&dir=${d}`)
        .setLabel(d)
        .setStyle(ButtonStyle.Success)
    );
  });
  rows.push(currentRow);

  await interaction.editReply({ embeds: [embed], components: rows });
}

/**
 * STEP 2: 目的地入力ボタン
 */
async function showDestInput(interaction, rideId, direction) {
  const embed = new EmbedBuilder()
    .setTitle('📢 相乗り希望 - 目的地入力')
    .setDescription(
      `方面: **${direction}**\n\n具体的な目的地（合流場所）を入力してください（任意）。\n※入力が難しい場合は、そのまま「次へ」進めます。`
    )
    .setColor(0x3498db);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`carpool|join|sub=dest_modal_trigger&rid=${rideId}&dir=${direction}`)
      .setLabel('🎯 目的地を入力する')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`carpool|join|sub=modal_trigger&rid=${rideId}&dir=${direction}&dest=`) // 既存のモーダル(人数)へ
      .setLabel('スキップして次へ')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * STEP 2.5: 目的地モーダル表示
 */
async function handleDestModalTrigger(interaction, rideId, direction) {
  const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
  const modal = new ModalBuilder()
    .setCustomId(`carpool|join|sub=modal&rid=${rideId}&dir=${direction}`)
    .setTitle('目的地・場所入力');

  const destInp = new TextInputBuilder()
    .setCustomId('input:carpool:location')
    .setLabel('具体的な目的地・場所 (任意)')
    .setPlaceholder('例: 〇〇ホテル、△△交差点')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  // ここで人数も一緒に聞くか、分けるか。仕様では「人数：」も入力。
  const countInp = new TextInputBuilder()
    .setCustomId('input:carpool:count')
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
