// handler/相乗り/却下理由選択.js
const {
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
} = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = {
  execute: async function (interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.REPLY, // エフェメラルでメニューを出す
      async run(interaction) {
        const rideId = parsed?.params?.rid;
        const userId = parsed?.params?.uid;

        const select = new StringSelectMenuBuilder()
          .setCustomId(`carpool|reject_reason|rid=${rideId}&uid=${userId}`)
          .setPlaceholder('却下理由を選択してください')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('場所が遠い')
              .setValue('場所が遠い')
              .setDescription('現在地から離れすぎています'),
            new StringSelectMenuOptionBuilder()
              .setLabel('時間的に間に合わない')
              .setValue('時間的に間に合わない')
              .setDescription('スケジュールの都合上'),
            new StringSelectMenuOptionBuilder()
              .setLabel('定員オーバー')
              .setValue('定員オーバー')
              .setDescription('乗車人数超過'),
            new StringSelectMenuOptionBuilder()
              .setLabel('その他 (メッセージ入力)')
              .setValue('message_input')
              .setDescription('理由を直接入力します')
          );

        const row = new ActionRowBuilder().addComponents(select);

        await interaction.editReply({
          content: '却下理由を選択してください（ユーザーに通知されます）',
          components: [row],
          ephemeral: true,
        });
      },
    });
  },
};
