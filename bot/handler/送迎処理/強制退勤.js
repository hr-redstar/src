// handler/送迎処理/VCコントロール/強制退勤.js

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const logger = require('../../utils/logger');
const forceOffDriver = require('../../utils/attendance/forceOffDriver');

module.exports = {
    // dispatch|forceOff
    execute: async function (interaction, client, parsed) {
        const sub = parsed.params?.sub;
        if (sub === 'execute') return module.exports.handleExecute(interaction, client);
        return module.exports.handleMenu(interaction, client);
    },

    // dispatch|forceOff|sub=menu
    async handleMenu(interaction, client) {
        return autoInteractionTemplate(interaction, {
            adminOnly: true,
            ack: ACK.REPLY_EPHEMERAL,
            panelKey: 'rideListPanel',
            async run(interaction) {
                const guildId = interaction.guildId;

                // 1. 待機中ドライバーの取得
                const { getQueue } = require('../../utils/配車/待機列マネージャ');
                const queue = await getQueue(guildId);

                // 2. 配車中ドライバーの取得
                const activeDir = paths.activeDispatchDir(guildId);
                const activeFiles = await store.listKeys(activeDir).catch(() => []);
                const activeDrivers = [];
                for (const fileKey of activeFiles) {
                    if (!fileKey.endsWith('.json')) continue;
                    const data = await store.readJson(fileKey).catch(() => null);
                    if (data && data.driverId) activeDrivers.push(data);
                }

                const options = [];
                const seenIds = new Set();

                // 待機中を追加
                for (const d of queue) {
                    if (seenIds.has(d.userId)) continue;
                    const label = d.nickname ? `待機中: ${d.nickname}` : `待機中: ${d.userId}`;
                    options.push({
                        label: label.substring(0, 100),
                        description: `${d.stopPlace || '位置不明'} | ${d.carInfo || '車種不明'}`,
                        value: d.userId,
                    });
                    seenIds.add(d.userId);
                }

                // 配車中を追加
                for (const d of activeDrivers) {
                    if (seenIds.has(d.driverId)) continue;
                    const label = d.driverNickname ? `送迎中: ${d.driverNickname}` : `送迎中: ${d.driverId}`;
                    options.push({
                        label: label.substring(0, 100),
                        description: `目的地: ${d.direction || d.from || '不明'}`,
                        value: d.driverId,
                    });
                    seenIds.add(d.driverId);
                }

                if (options.length === 0) {
                    return interaction.editReply({ content: '現在、アクティブな送迎者はいないようです。' });
                }

                const buildPanelEmbed = require('../../utils/embed/embedTemplate');
                const embed = buildPanelEmbed({
                    title: '🛑 管理者：強制退勤実行',
                    description: '強制退勤させるドライバーを選択してください。\n(選択すると即座に退勤・クリーンアップが行われます)',
                    color: 0xe74c3c,
                    client: interaction.client
                });

                const select = new StringSelectMenuBuilder()
                    .setCustomId('dispatch|forceOff|sub=execute')
                    .setPlaceholder('対象のドライバーを選択...')
                    .addOptions(options.slice(0, 25));

                const row = new ActionRowBuilder().addComponents(select);

                await interaction.editReply({
                    embeds: [embed],
                    components: [row],
                });
            },
        });
    },

    // dispatch|forceOff|sub=execute
    async handleExecute(interaction, client) {
        return autoInteractionTemplate(interaction, {
            adminOnly: true,
            ack: ACK.UPDATE,
            panelKey: 'rideListPanel',
            async run(interaction) {
                const driverId = interaction.values[0];

                const { profile, clearedDispatch, clearedCount } = await forceOffDriver({
                    guild: interaction.guild,
                    driverId,
                    executor: interaction.user,
                });

                const { updateDriverPanel } = require('../送迎パネル/メイン');
                const { updateRideListPanel } = require('./一覧パネル更新');

                await Promise.all([
                    updateDriverPanel(interaction.guild, client),
                    updateRideListPanel(interaction.guild, client),
                ]).catch(err => logger.error(`強制退勤後パネル更新失敗: ${err}`));

                const statusText = clearedCount > 0 ? `送迎中(${clearedCount}件)および待機状態` : '待機状態';
                await interaction.editReply({
                    content: `🛑 <@${driverId}> の ${statusText} を強制的にクリーンアップしました。`,
                    components: [],
                });
            },
        });
    },
};
