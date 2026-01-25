const {
    StringSelectMenuBuilder,
    ActionRowBuilder,
    EmbedBuilder,
    Colors,
} = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * 送迎者ランク設定 - ランク選択メニューを表示
 */
module.exports = {
    customId: 'op|rank|sub=user_select',
    type: 'userSelect',
    async execute(interaction, client, parsed) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO, // コンポーネント更新するので AUTO (REPLY でも可だが)
            adminOnly: true,
            async run(interaction) {
                const targetUserId = interaction.values[0];
                const targetUser = interaction.users.get(targetUserId);
                const userName = targetUser ? targetUser.username : targetUserId;
                const guildId = interaction.guildId;

                // 登録済みランクを取得
                const config = await loadConfig(guildId);
                const availableRanks = config.driverRanks || [];

                if (availableRanks.length === 0) {
                    return interaction.editReply({
                        content: '⚠️ ランク階級が登録されていません。先に「送迎者ランク階級登録」を行ってください。',
                        embeds: [],
                        components: [],
                    });
                }

                // ユーザーの現在のデータを取得
                const userPath = paths.userJson(guildId, targetUserId);
                const userData = await store.readJson(userPath, {}).catch(() => ({}));
                const currentRank = userData.driverRank || '未設定';

                const embed = new EmbedBuilder()
                    .setTitle(`${userName} のランク設定`)
                    .setDescription(`現在のランク: **${currentRank}**\n\n設定するランクを選択してください。`)
                    .setColor(Colors.Blue);

                const options = availableRanks.map((rank) => ({
                    label: rank,
                    value: rank,
                    description: `${rank}ランクに設定します`,
                    default: rank === currentRank,
                }));

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`op|rank|sub=rank_select|uid=${targetUserId}`)
                    .setPlaceholder('ランクを選択してください')
                    .addOptions(options);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                await interaction.editReply({
                    embeds: [embed],
                    components: [row],
                });
            },
        });
    },
};
