const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const { EmbedBuilder, Colors } = require('discord.js');
const updateOperatorPanel = require('./updatePanel');

/**
 * 送迎者ランク階級登録完了 - モーダル送信後の処理
 */
module.exports = {
    customId: 'op|rank|sub=modal',
    type: 'modalSubmit',
    async execute(interaction) {
        return autoInteractionTemplate(interaction, {
            ack: ACK.AUTO,
            adminOnly: true,
            async run(interaction) {
                const guildId = interaction.guildId;
                const ranksText = interaction.fields.getTextInputValue('rank_names');

                // 改行で分割し、空白行を除去
                const ranksList = ranksText
                    .split('\n')
                    .map((r) => r.trim())
                    .filter((r) => r.length > 0);

                // Config 読み込み
                const config = await loadConfig(guildId);

                // 更新
                config.driverRanks = ranksList;

                // 保存
                await saveConfig(guildId, config);

                const embed = new EmbedBuilder()
                    .setTitle('✅ 送迎者ランク階級登録完了')
                    .setDescription(`以下のランク階級を登録しました（${ranksList.length}件）。`)
                    .setColor(Colors.Green)
                    .setTimestamp();

                if (ranksList.length > 0) {
                    embed.addFields({
                        name: '登録ランク',
                        value: ranksList.map((r, i) => `${i + 1}. ${r}`).join('\n'),
                    });
                }

                await interaction.editReply({
                    embeds: [embed],
                    components: [],
                });

                // パネルを更新（ランク情報はパネルには直接出ないかもしれないが、データ更新として呼び出す）
                const guild = interaction.guild;
                const client = interaction.client;
                await updateOperatorPanel(guild, client);
            },
        });
    },
};
