// handler/パネル設置/アクション/パネル設置フロー.js
// v1.6.2 (Professional Setup Flow)

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
} = require('discord.js');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
const { deployPanel } = require('./パネル送信ヘルパー');

/**
 * パネル設置の対話型フロー (v1.6.2)
 */
module.exports = {
    async execute(interaction, client, parsed) {
        // ステップ判定: adm|panel_setup|step=... or ps|send|panel=...
        let step = parsed?.params?.step || 'select_type';

        // 直送 (ps|send|panel=driver 等) の互換性
        if (parsed.action === 'send' && parsed.params.panel) {
            step = 'select_channel';
            // interaction.values に期待される形式をセット
            interaction.values = [parsed.params.panel];
        }

        return autoInteractionTemplate(interaction, {
            adminOnly: true,
            ack: ACK.AUTO,

            async run(interaction) {
                if (step === 'select_type') return showPanelTypeSelect(interaction);
                if (step === 'select_channel') return showChannelSelect(interaction, parsed);
                if (step === 'deploy') return handleDeploy(interaction, parsed);

                throw new Error(`未知のステップです: ${step}`);
            },
        });
    },
};

/**
 * 1. パネル種別選択 (Professional UI)
 */
async function showPanelTypeSelect(interaction) {
    const embed = buildPanelEmbed({
        title: '🧩 パネルの新規設置',
        description: '設置したい **パネルの種類** を選択してください。\n各パネルは設置後に自動的にサーバー設定と同期されます。',
        fields: [
            { name: '💡 Tip', value: '既に設置済みのパネルがある場合、新しい場所に設置し直すと古いパネル情報は自動的に更新されます。' }
        ],
        color: 0x3498db, // Business Blue
        client: interaction.client,
    });

    const select = new StringSelectMenuBuilder()
        .setCustomId('adm|panel_setup|step=select_channel')
        .setPlaceholder('パネルを選択してください')
        .addOptions([
            { label: '🚗 送迎者パネル', value: 'driver_panel', description: '出勤・退勤・状態管理用' },
            { label: '🙋 利用者パネル', value: 'user_panel', description: '送迎依頼・受付用' },
            { label: '📋 送迎一覧パネル', value: 'ride_list_panel', description: '現在の稼働状況を表示' },
            { label: '📝 送迎者登録パネル', value: 'driver_reg_panel', description: '新規送迎者の申請・登録用' },
            { label: '👤 利用者登録パネル', value: 'user_reg_panel', description: '新規利用者の申請・登録用' },
            { label: '🏆 口コミランクパネル', value: 'rating_rank_panel', description: '評価・統計・ランキング閲覧' },
            { label: '⚙️ 管理者パネル', value: 'admin_panel', description: 'システム全体の設定・ログ管理' },
            { label: '🔰 案内パネル', value: 'guide_panel', description: '利用マニュアル・使い方の案内' },
        ]);

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.editReply({
        embeds: [embed],
        components: [row],
    });
}

/**
 * 2. 設置先チャンネル選択
 */
async function showChannelSelect(interaction, parsed) {
    const panelType = interaction.values?.[0];
    if (!panelType) throw new Error('パネル種別が選択されていません。');

    const typeLabels = {
        driver_panel: '送迎者パネル',
        user_panel: '利用者パネル',
        ride_list_panel: '送迎一覧パネル',
        driver_reg_panel: '送迎者登録パネル',
        user_reg_panel: '利用者登録パネル',
        rating_rank_panel: '口コミランクパネル',
        admin_panel: '管理者パネル',
        guide_panel: '案内パネル',
        operator_panel: '運営者パネル',
    };

    const embed = buildPanelEmbed({
        title: '📍 設置先チャンネルの選択',
        description: `**${typeLabels[panelType] || panelType}** を設置するチャンネルを選択してください。`,
        color: 0xf1c40f, // Warning/Action Gold
        client: interaction.client,
    });

    const select = new ChannelSelectMenuBuilder()
        .setCustomId(`adm|panel_setup|step=deploy&type=${panelType}`)
        .setPlaceholder('設置先のチャンネルを選択してください')
        .setChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(select);

    await interaction.editReply({
        embeds: [embed],
        components: [row],
    });
}

/**
 * 3. デプロイ実行 (Final Step)
 */
async function handleDeploy(interaction, parsed) {
    const panelType = parsed.params.type;
    const channelId = interaction.values?.[0];

    if (!panelType || !channelId) throw new Error('必要なパラメータが不足しています。');

    // デプロイの実行
    await deployPanel({
        guild: interaction.guild,
        channelId,
        panelType,
        user: interaction.user,
    });

    const embed = buildPanelEmbed({
        title: '✅ パネル設置完了',
        description: `<#${channelId}> にパネルを正常に設置しました。`,
        color: 0x2ecc71, // Success Green
        client: interaction.client,
    });

    await interaction.editReply({
        embeds: [embed],
        components: [],
    });

    // 1分後にメッセージを削除 (Ephemeral でも editReply したものは削除可能)
    setTimeout(() => interaction.deleteReply().catch(() => { }), 60_000);
}
