const {
    ActionRowBuilder,
    UserSelectMenuBuilder,
} = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 送迎者ランク設定 - ユーザー選択メニューを表示
 */
module.exports = {
    customId: 'op|rank|sub=assignment_start',
    type: 'button',
    async execute(interaction, client, parsed) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            adminOnly: true,
            async run(interaction) {
                const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
                const paths = require('../../utils/ストレージ/ストレージパス');
                const store = require('../../utils/ストレージ/ストア共通');

                const embed = buildPanelEmbed({
                    title: '[管理] 送迎者ランク設定',
                    description: 'ランクを設定したい送迎者（ユーザー）を選択してください。',
                    type: 'info',
                    client
                });

                // 登録済み送迎者のリストを取得
                const indexPath = paths.guildDriverIndexJson(interaction.guildId);
                const driverIds = await store.readJson(indexPath, []).catch(() => []);

                if (driverIds.length === 0) {
                    return interaction.editReply({
                        content: '⚠️ 登録済みの送迎者が一人もいないため、ランクを設定できません。',
                    });
                }

                // 送迎者情報を並列で読み込み
                const driverOptions = await Promise.all(driverIds.slice(0, 25).map(async (uid) => {
                    const profilePath = paths.driverProfileJson(interaction.guildId, uid);
                    const profile = await store.readJson(profilePath).catch(() => null);
                    const name = profile?.current?.nickname || profile?.current?.name || profile?.nickname || profile?.name || uid;
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(name.substring(0, 100))
                        .setDescription(`ID: ${uid}`)
                        .setValue(uid);
                }));

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('op|rank|sub=user_select')
                    .setPlaceholder('ランクを設定する送迎者を選択')
                    .addOptions(driverOptions);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                await interaction.editReply({
                    embeds: [embed],
                    components: [row],
                });
            },
        });
    },
};
