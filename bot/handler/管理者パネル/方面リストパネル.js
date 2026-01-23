// src/bot/handler/管理者パネル/方面リストパネル.js
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
} = require('discord.js');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

const CID = {
    BTN_EDIT_DIRECTIONS: 'dir|edit_dirs',
    BTN_EDIT_AREAS_START: 'dir|edit_areas_start',
    SEL_DIRECTION_FOR_AREAS: 'dir|sel_dir_areas',
    MODAL_EDIT_DIRECTIONS: 'dir|modal_dirs',
    MODAL_EDIT_AREAS: 'dir|modal_areas',
};

/**
 * 方面リスト設定パネルのメッセージを構築
 */
async function buildDirectionsPanelMessage(guild) {
    const cfg = await loadConfig(guild.id);
    const directions = cfg.directions || [];
    const directionAreas = cfg.directionAreas || {};

    let description = '🚕 **方面リストと地名（エリア）の管理**\n\n';

    if (directions.length === 0) {
        description += '⚠️ 方面が登録されていません。';
    } else {
        directions.forEach((dir) => {
            const areas = directionAreas[dir] || [];
            description += `📍 **${dir}**\n\`${areas.join(', ') || '地名未登録'}\`\n\n`;
        });
    }

    const embed = buildPanelEmbed({
        title: '方面リスト設定',
        description: description,
        color: 0x3498db,
        client: guild.client,
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(CID.BTN_EDIT_DIRECTIONS)
            .setLabel('方面リストを編集')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(CID.BTN_EDIT_AREAS_START)
            .setLabel('地名リストを編集')
            .setStyle(ButtonStyle.Success)
            .setDisabled(directions.length === 0)
    );

    return buildPanelMessage({ embed, components: [row] });
}

/**
 * 他の操作からパネルの表示状態を更新したい場合に呼ぶ
 */
async function updateDirectionsPanel(guild) {
    const config = await loadConfig(guild.id);
    const panel = config.panels?.directions;
    if (!panel || !panel.channelId || !panel.messageId) return;

    const ch = await guild.channels.fetch(panel.channelId).catch(() => null);
    if (!ch) return;

    const { sendOrUpdatePanel } = require('../共通/パネル送信');
    await sendOrUpdatePanel({
        channel: ch,
        messageId: panel.messageId,
        buildMessage: () => buildDirectionsPanelMessage(guild),
        suppressFallback: true,
    });
}

/**
 * インタラクションハンドラ
 */
async function execute(interaction, client, parsed) {
    const { customId } = interaction;

    return autoInteractionTemplate(interaction, {
        adminOnly: true,
        ack: interaction.isModalSubmit() ? ACK.NONE : (customId === CID.BTN_EDIT_DIRECTIONS || customId === CID.BTN_EDIT_AREAS_START ? ACK.AUTO : ACK.REPLY),
        async run(interaction) {
            const cfg = await loadConfig(interaction.guildId);

            // --- 1. 方面リスト編集 (Modal) ---
            if (customId === CID.BTN_EDIT_DIRECTIONS) {
                const modal = new ModalBuilder()
                    .setCustomId(CID.MODAL_EDIT_DIRECTIONS)
                    .setTitle('方面リスト編集');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('directions')
                            .setLabel('方面リスト（改行区切り）')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('新宿方面\n渋谷方面\n立川方面')
                            .setValue((cfg.directions || []).join('\n'))
                            .setRequired(true)
                    )
                );
                return await interaction.showModal(modal);
            }

            // --- 2. 地名編集：方面選択 (Select Menu) ---
            if (customId === CID.BTN_EDIT_AREAS_START) {
                const directions = cfg.directions || [];
                const select = new StringSelectMenuBuilder()
                    .setCustomId(CID.SEL_DIRECTION_FOR_AREAS)
                    .setPlaceholder('地名を編集する方面を選択');

                directions.forEach((dir) => {
                    select.addOptions({ label: dir, value: dir });
                });

                const row = new ActionRowBuilder().addComponents(select);
                return await interaction.editReply({ content: '地名を編集したい方面を選択してください。', components: [row] });
            }

            // --- 3. 地名編集：モーダル表示 ---
            if (customId === CID.SEL_DIRECTION_FOR_AREAS) {
                const targetDir = interaction.values[0];
                const modal = new ModalBuilder()
                    .setCustomId(`${CID.MODAL_EDIT_AREAS}?dir=${targetDir}`) // query形式で方面を渡す
                    .setTitle(`${targetDir} の地名編集`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('areas')
                            .setLabel('地名リスト（カンマまたは改行区切り）')
                            .setStyle(TextInputStyle.Paragraph)
                            .setPlaceholder('a町, b町, c町...')
                            .setValue((cfg.directionAreas?.[targetDir] || []).join('\n'))
                            .setRequired(false)
                    )
                );
                return await interaction.showModal(modal);
            }

            // --- 4. モーダル送信：方面保存 ---
            if (customId === CID.MODAL_EDIT_DIRECTIONS) {
                const raw = interaction.fields.getTextInputValue('directions');
                const newDirs = raw.split('\n').map((d) => d.trim()).filter(Boolean);

                // 既存の地名データを引き継ぐ（方面名が変わった場合は消えるが、基本は維持）
                cfg.directions = newDirs;
                await saveConfig(interaction.guildId, cfg);
                await updateDirectionsPanel(interaction.guild);
                return interaction.editReply({ content: '✅ 方面リストを更新しました。', components: [] });
            }

            // --- 5. モーダル送信：地名保存 ---
            if (customId.startsWith(CID.MODAL_EDIT_AREAS)) {
                const params = new URLSearchParams(customId.split('?')[1]);
                const targetDir = params.get('dir');
                const raw = interaction.fields.getTextInputValue('areas');
                const newAreas = raw.split(/[,\n]/).map((a) => a.trim()).filter(Boolean);

                cfg.directionAreas ??= {};
                cfg.directionAreas[targetDir] = newAreas;

                await saveConfig(interaction.guildId, cfg);
                await updateDirectionsPanel(interaction.guild);
                return interaction.editReply({ content: `✅ ${targetDir} の地名リストを更新しました。`, components: [] });
            }
        },
    });
}

module.exports = {
    buildDirectionsPanelMessage,
    updateDirectionsPanel,
    execute,
};
