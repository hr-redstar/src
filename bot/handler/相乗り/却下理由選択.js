// handler/相乗り/却下理由選択.js
const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const interactionTemplate = require("../共通/interactionTemplate");
const { ACK } = interactionTemplate;

module.exports = {
    execute: async function (interaction) {
        // carpool:reject:{rideId}:{userId}
        const parts = interaction.customId.split(':');
        // セレクトメニューのIDに情報を埋め込む
        // select:reject_reason:{rideId}:{userId}
        const customId = `carpool:reject_reason:${parts[2]}:${parts[3]}`;

        return interactionTemplate(interaction, {
            ack: ACK.REPLY, // エフェメラルでメニューを出す
            async run(interaction) {
                const select = new StringSelectMenuBuilder()
                    .setCustomId(customId)
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
                    content: "却下理由を選択してください（ユーザーに通知されます）",
                    components: [row],
                    ephemeral: true
                });
            }
        });
    }
};
