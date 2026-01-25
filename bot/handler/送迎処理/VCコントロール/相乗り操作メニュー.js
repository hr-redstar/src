const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonStyle,
    ButtonBuilder,
} = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 相乗り者選択メニューを表示する (v2.9.2)
 * @param {import('discord.js').Interaction} interaction
 * @param {string} actionType - carpool_approach, carpool_start, carpool_end
 * @param {string} rideId
 */
async function showCarpoolSelectMenu(interaction, actionType, rideId) {
    return autoInteractionTemplate(interaction, {
        ack: ACK.REPLY_EPHEMERAL,
        async run(interaction) {
            const guildId = interaction.guildId;
            const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
            const dispatchData = await store.readJson(activePath).catch(() => null);

            if (!dispatchData || !dispatchData.carpoolUsers || dispatchData.carpoolUsers.length === 0) {
                return interaction.editReply({ content: '⚠️ 現在、この送迎に相乗り者は登録されていません。' });
            }

            // アクションに応じたラベルとフィルタリング
            const actionLabels = {
                carpool_approach: '合流場所へ向かう',
                carpool_start: '送迎を開始する',
                carpool_end: '送迎を終了する',
            };

            const options = dispatchData.carpoolUsers.map((u, idx) => ({
                label: `${u.userName || 'ユーザー'} (${u.pickup || '不明'})`,
                description: `ステータス: ${u.status || '待機中'}`,
                value: `${idx}`, // インデックスを値にする
            }));

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`ride|carpool_select|type=${actionType}&rid=${rideId}`)
                .setPlaceholder(`対象の相乗り者を選択してください`)
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(menu);

            await interaction.editReply({
                content: `**【${actionLabels[actionType]}】** 対象ユーザーを選択してください。`,
                components: [row],
            });
        },
    });
}

/**
 * 選択された相乗り者に対してアクションを実行
 */
async function handleCarpoolAction(interaction, client, parsed) {
    const type = parsed.params?.type;
    const rid = parsed.params?.rid;
    const index = parseInt(interaction.values[0]);

    return autoInteractionTemplate(interaction, {
        ack: ACK.UPDATE_EPHEMERAL,
        async run(interaction) {
            const { updateDispatchProgress } = require('../../配車システム/dispatchProgressUpdater');
            const guildId = interaction.guildId;
            const activePath = `${paths.activeDispatchDir(guildId)}/${rid}.json`;
            const dispatchData = await store.readJson(activePath).catch(() => null);

            if (!dispatchData || !dispatchData.carpoolUsers?.[index]) {
                return interaction.editReply({ content: '⚠️ データが見つかりません。', components: [] });
            }

            const targetUser = dispatchData.carpoolUsers[index];
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

            // ステータス更新
            if (type === 'carpool_approach') {
                targetUser.status = 'HEADING';
                targetUser.headingTime = timeStr;
            } else if (type === 'carpool_start') {
                targetUser.status = 'STARTED';
                targetUser.startTime = timeStr;
            } else if (type === 'carpool_end') {
                targetUser.status = 'COMPLETED';
                targetUser.endTime = timeStr;
            }

            await updateDispatchProgress({
                guild: interaction.guild,
                rideId: rid,
                updates: { carpoolUsers: dispatchData.carpoolUsers },
            });

            // 本人通知
            const statusLabel = {
                carpool_approach: '相乗り向かっています',
                carpool_start: '相乗り送迎開始',
                carpool_end: '相乗り送迎終了',
            }[type];

            await interaction.editReply({
                content: `※${statusLabel}：<@${targetUser.userId}> (${timeStr})`,
                components: [],
            });
        },
    });
}

module.exports = { showCarpoolSelectMenu, handleCarpoolAction };
