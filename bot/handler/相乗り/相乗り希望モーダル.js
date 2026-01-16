// handler/相乗り/相乗り希望モーダル.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const interactionTemplate = require("../共通/interactionTemplate");
const { ACK } = interactionTemplate;

module.exports = {
    execute: async function (interaction) {
        return interactionTemplate(interaction, {
            ack: ACK.REPLY,
            async run(interaction) {
                const parts = interaction.customId.split(':');
                const rideId = parts[3];
                const userId = interaction.user.id; // 相乗り希望者
                const guildId = interaction.guildId;

                const location = interaction.fields.getTextInputValue('input:carpool:location');
                const countStr = interaction.fields.getTextInputValue('input:carpool:count');
                const count = parseInt(countStr) || 1;

                // 配車データの読み込み
                const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
                const rideData = await store.readJson(activePath).catch(() => null);

                if (!rideData || rideData.status !== 'dispatching') {
                    await interaction.editReply("❌ この送迎は既に終了しているか、無効です。");
                    return;
                }

                // ドライバーへDM送信
                const driverId = rideData.driverId;
                const driverUser = await interaction.guild.members.fetch(driverId).catch(() => null);

                if (!driverUser) {
                    await interaction.editReply("❌ ドライバーが見つかりませんでした。");
                    return;
                }

                const embed = new EmbedBuilder()
                    .setTitle('📢 相乗りリクエスト')
                    .setDescription(`あなたの現在送迎中の便に、相乗り希望が届きました。`)
                    .addFields(
                        { name: '希望者', value: `<@${userId}>` },
                        { name: '人数', value: `${count}名` },
                        { name: '希望場所', value: location },
                        { name: 'ルート概要', value: `【${rideData.driverPlace || '現在地'}】→【${rideData.mark || '不明'}】→【${rideData.destination}】` }
                    )
                    .setColor(0xFFA500)
                    .setFooter({ text: '※承認すると自動的にVCに追加されます' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`carpool:approve:${rideId}:${userId}:${count}`) // 人数も含める
                        .setLabel('承認')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`carpool:reject:${rideId}:${userId}`)
                        .setLabel('却下')
                        .setStyle(ButtonStyle.Danger)
                );

                try {
                    await driverUser.send({ embeds: [embed], components: [row] });
                    await interaction.editReply("✅ ドライバーに相乗りリクエストを送信しました。\n承認されるまでしばらくお待ちください。");
                } catch (e) {
                    console.error("相乗りリクエストDM送信失敗", e);
                    await interaction.editReply("❌ ドライバーへのリクエスト送信に失敗しました（DM拒否設定など）。");
                }
            }
        });
    }
};
