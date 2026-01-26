// handler/自動設定/自動設定パネル.js
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    PermissionFlagsBits,
    ChannelType,
} = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');
const { loadConfig } = require('../../utils/設定/設定マネージャ');

/**
 * 自動設定パネルを送信
 */
async function sendAutoSetupPanel(interaction) {
    const handlerRun = async (interaction) => {
        const client = interaction.client;
        const guild = interaction.guild;

        const embed = buildPanelEmbed({
            title: '🏗️ サーバー自動設定パネル',
            description: [
                'サーバーの運用に必要なカテゴリー・テキストチャンネルを一括で構築します。',
                '既に存在する場合はスキップされるため、安全に再実行可能です。',
                '',
                '**構築対象:**',
                '・入口・登録カテゴリー（案内・登録パネル）',
                '・運営者用カテゴリー（管理者用各種パネル）',
                '・送迎者カテゴリー（操作パネル）',
                '・利用者カテゴリー（操作パネル・通知）',
                '・プライベートVCカテゴリー（動的生成用）',
                '・ユーザーメモカテゴリー（個別管理用）'
            ].join('\n'),
            client,
        });

        const components = buildAutoSetupComponents();

        const payload = {
            embeds: [embed],
            components,
        };

        if (interaction.isChatInputCommand()) {
            await interaction.editReply(payload);
        } else {
            await interaction.editReply(payload);
        }
    };

    if (interaction.isChatInputCommand()) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }
        return handlerRun(interaction);
    }

    return autoInteractionTemplate(interaction, {
        ack: ACK.AUTO,
        adminOnly: true,
        run: handlerRun,
    });
}

function buildAutoSetupComponents() {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('setup|all')
            .setLabel('全カテゴリー一括作成')
            .setEmoji('🚀')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('setup|entry')
            .setLabel('入口・登録カテゴリー')
            .setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('setup|admin')
            .setLabel('運営者カテゴリー')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('setup|driver')
            .setLabel('送迎者カテゴリー')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('setup|user')
            .setLabel('利用者カテゴリー')
            .setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('setup|pvc')
            .setLabel('プライベートVCカテゴリー')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('setup|memo')
            .setLabel('ユーザーメモカテゴリー')
            .setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2, row3];
}

/**
 * ボタンインタラクションのルーティング
 */
async function execute(interaction, client, parsed) {
    const action = parsed.action; // setup
    const sub = parsed.params?.sub; // all, entry, admin, etc.

    const setupLogic = require('./setupLogic');

    return autoInteractionTemplate(interaction, {
        ack: ACK.AUTO,
        adminOnly: true,
        async run(interaction) {
            let result = [];

            switch (sub) {
                case 'all':
                    result = await setupLogic.setupAll(interaction);
                    break;
                case 'entry':
                    result = [await setupLogic.setupEntryCategory(interaction)];
                    break;
                case 'admin':
                    result = [await setupLogic.setupAdminCategory(interaction)];
                    break;
                case 'driver':
                    result = [await setupLogic.setupDriverCategory(interaction)];
                    break;
                case 'user':
                    result = [await setupLogic.setupUserCategory(interaction)];
                    break;
                case 'pvc':
                    result = [await setupLogic.setupPrivateVcCategory(interaction)];
                    break;
                case 'memo':
                    result = [await setupLogic.setupUserMemoCategory(interaction)];
                    break;
            }

            const summary = formatSetupResult(result);
            await interaction.editReply({
                content: summary,
                embeds: [],
                components: [],
            });
        }
    });
}

function formatSetupResult(results) {
    const created = results.filter(r => r.status === 'created').map(r => `・${r.name}`);
    const skipped = results.filter(r => r.status === 'skipped').map(r => `・${r.name}`);
    const failed = results.filter(r => r.status === 'error').map(r => `・${r.name} (${r.error})`);

    let text = '✅ **自動設定が完了しました**\n\n';

    if (created.length > 0) {
        text += `**【作成・設定完了】**\n${created.join('\n')}\n\n`;
    }
    if (skipped.length > 0) {
        text += `**【既に存在（スキップ）】**\n${skipped.join('\n')}\n\n`;
    }
    if (failed.length > 0) {
        text += `**【エラー】**\n${failed.join('\n')}\n\n`;
    }

    return text;
}

module.exports = sendAutoSetupPanel;
module.exports.execute = execute;
