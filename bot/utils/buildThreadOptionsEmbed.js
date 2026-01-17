const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');

/**
 * スレッド作成オプションEmbedとSelect Menuを生成
 * @returns {Object} { embed, components }
 */
function buildThreadOptionsEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('📁 履歴メモの整理（スレッド化）について')
    .setDescription(
      '登録情報の履歴が増えた場合、\n' +
      'このメモチャンネルを見やすく保つため\n' +
      '履歴をスレッドにまとめることができます。\n\n' +
      '**■ 選択可能な期間**\n' +
      '・1週間\n' +
      '・2週間\n' +
      '・1か月\n' +
      '・半年\n\n' +
      '※ 選択がない場合、スレッドは作成されません\n' +
      '※ この設定は再登録時に変更可能です'
    )
    .setColor(0x95a5a6)
    .setFooter({ text: '設定は登録時の選択内容に基づいて自動処理されます' });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('memo|threadpolicy|sub=select')
    .setPlaceholder('スレッド作成期間を選択（任意）')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('スレッド作成しない')
        .setValue('none')
        .setDescription('履歴はすべてメインチャンネルに追記されます')
        .setDefault(true),
      new StringSelectMenuOptionBuilder()
        .setLabel('1週間ごと')
        .setValue('1w')
        .setDescription('1週間ごとに新しいスレッドを作成'),
      new StringSelectMenuOptionBuilder()
        .setLabel('2週間ごと')
        .setValue('2w')
        .setDescription('2週間ごとに新しいスレッドを作成'),
      new StringSelectMenuOptionBuilder()
        .setLabel('1か月ごと')
        .setValue('1m')
        .setDescription('1か月ごとに新しいスレッドを作成'),
      new StringSelectMenuOptionBuilder()
        .setLabel('半年ごと')
        .setValue('6m')
        .setDescription('半年ごとに新しいスレッドを作成')
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  return {
    embed,
    components: [row],
  };
}

module.exports = {
  buildThreadOptionsEmbed,
};
