const {
    ActionRowBuilder,
    UserSelectMenuBuilder,
} = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * ユーザークレジット登録 - ユーザー選択メニューを表示
 */
module.exports = {
    customId: 'op|credits|sub=start',
    type: 'button',
    async execute(interaction, client, parsed) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            adminOnly: true,
            async run(interaction) {
                const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
                const paths = require('../../utils/ストレージ/ストレージパス');
                const store = require('../../utils/ストレージ/ストア共通');

                // 登録済み利用者のリストを取得
                const indexPath = paths.guildUserIndexJson(interaction.guildId);
                const userIds = await store.readJson(indexPath, []).catch(() => []);

                if (userIds.length === 0) {
                    return interaction.editReply({
                        content: '⚠️ 登録済みの利用者が一人もいないため、クレジットを設定できません。',
                    });
                }

                // ユーザー情報を並列で読み込み
                const userOptions = await Promise.all(userIds.slice(0, 25).map(async (uid) => {
                    const profilePath = paths.userProfileJson(interaction.guildId, uid);
                    const profile = await store.readJson(profilePath).catch(() => null);
                    const name = profile?.current?.storeName || profile?.current?.name || profile?.storeName || profile?.name || uid;
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(name.substring(0, 100))
                        .setDescription(`ID: ${uid}`)
                        .setValue(uid);
                }));

                const embed = buildPanelEmbed({
                    title: '[管理] ユーザークレジット設定',
                    description: 'クレジットを登録（または変更）したい利用者を選択してください。',
                    type: 'info',
                    client
                });

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('op|credits|sub=user_select')
                    .setPlaceholder('クレジットを設定する利用者を選択')
                    .addOptions(userOptions);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                await interaction.editReply({
                    embeds: [embed],
                    components: [row],
                });
            },
        });
    },
};
