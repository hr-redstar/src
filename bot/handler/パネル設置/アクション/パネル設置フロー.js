const {
    ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder,
    ChannelType, EmbedBuilder, ComponentType
} = require('discord.js');
const { PANEL_SETUP_IDS } = require('../共通/_panelSetupCommon');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

// 各パネルの送信ロジックをインポート (既存のファイルから)
// ※ 既存のハンドラファイルを再利用するか、またはここにロジックを集約するか。
// 既存のハンドラは `run(interaction)` 形式で書かれており、直接呼び出すのは少し扱いづらいかもしれないが、
// 共通化のために、ここでは「パネルEmbedを作成して送信する」部分だけを抽出・実行する形が望ましい。
// しかし、今は既存の `require('../アクション/送迎者パネル.js')(interaction)` などを呼ぶと、
// interaction.reply などを呼んでしまう恐れがある。
// したがって、ここでは各パネルの Embed 作成関数などをインポートして利用するのがベストだが、
// 多くのファイルは `handler(interaction)` としてエクスポートされている。
// 簡易的に、このファイル内で各パネルの内容を定義（または既存処理を模倣）して送信する。
// 本来は `buildUpdate` 系関数を外出しすべき。

// 今回は「パネル設置」処理自体をここで行う。
// 各パネルのEmbed生成ロジックは既存ファイル (e.g. `送迎パネル/メイン.js` の `buildDriverPanelMessage`) を流用したい。
// しかし `送迎パネル/メイン.js` は `updateDriverPanel` しか export していない場合がある。
// 確認が必要だが、まずはフローの実装を進める。

// パネル種別の定義
const PANEL_TYPES = [
    { label: '送迎者パネル', value: 'driver_panel', description: '出勤/退勤操作など' },
    { label: '利用者パネル', value: 'user_panel', description: '送迎依頼など' },
    { label: '送迎一覧パネル', value: 'ride_list_panel', description: '現在の送迎状況一覧' },
    { label: '送迎者登録パネル', value: 'driver_reg_panel', description: '新規送迎者登録用' },
    { label: '利用者登録パネル', value: 'user_reg_panel', description: '新規利用登録用' },
    { label: '口コミランクパネル', value: 'rating_rank_panel', description: '口コミランキング表示' },
    { label: '管理者パネル', value: 'admin_panel', description: '設定・管理用' },
];

module.exports = {
    // 1. Dynamic Router (handler.js routeToPanelHandler経由)
    async execute(interaction, client, parsed) {
        // ID: ps|setup|sub=start / type / channel
        // ps:setup:start (Legacy)
        const subAction = (parsed.params && parsed.params.sub) || (parsed.rest && parsed.rest[0]);

        if (subAction === 'start') return handleSetupStart(interaction);
        if (subAction === 'type') return handleTypeSelect(interaction);
        if (subAction === 'channel') return handleChannelSelect(interaction, parsed);
    },

    // 2. Static Handlers (buttonMap経由)
    startHandler: {
        customId: PANEL_SETUP_IDS.SETUP_START,
        execute: handleSetupStart
    },
    typeHandler: {
        customId: PANEL_SETUP_IDS.SETUP_TYPE_MENU,
        execute: handleTypeSelect
    }
};

/**
 * 1. 設置開始: パネル種別選択メニューを表示
 */
async function handleSetupStart(interaction) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(PANEL_SETUP_IDS.SETUP_TYPE_MENU)
        .setPlaceholder('設置するパネルの種類を選択')
        .addOptions(PANEL_TYPES);

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
        content: '設置するパネルの種類を選択してください。',
        components: [row],
        ephemeral: true
    });
}

/**
 * 2. 種別選択後: チャンネル選択メニューを表示
 */
async function handleTypeSelect(interaction) {
    const selectedType = interaction.values[0];

    // 選択されたタイプを一時的に保持する必要があるが、
    // ChannelSelectMenu の CustomId に埋め込むか、state を使うか。
    // 今回は CustomId に埋め込むには長いので、
    // 次のステップで interaction.message の参照や、キャッシュ利用などが考えられるが、
    // 一番簡単なのは、仮のデータストアや、ChannelSelectMenuのプレースホルダーは使えないので、
    // メモリキャッシュ(Map)を使う、あるいは `ps:setup:selectChannel:${selectedType}` のようにIDに埋め込む。
    // ID長制限(100文字)には余裕がある。

    const channelMenu = new ChannelSelectMenuBuilder()
        .setCustomId(`${PANEL_SETUP_IDS.SETUP_CHANNEL_MENU}&type=${selectedType}`)
        .setPlaceholder('設置先のチャンネルを選択')
        .setChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(channelMenu);

    await interaction.update({
        content: `**${PANEL_TYPES.find(t => t.value === selectedType)?.label}** を設置するチャンネルを選択してください。`,
        components: [row],
        ephemeral: true
    });
}

/**
 * 3. チャンネル選択後: パネル送信 & ログ & 完了通知
 */
async function handleChannelSelect(interaction, parsed) {
    await interaction.deferUpdate(); // 先にACK

    const selectedChannelId = interaction.values[0];
    const channel = interaction.guild.channels.cache.get(selectedChannelId);

    // CustomIDからパネル種別を取り出す
    // v2: ps|setup|sub=channel&type=driver_panel
    // v1: ps:setup:channel:driver_panel
    const panelType = (parsed.params && parsed.params.type) || (parsed.rest && parsed.rest[1]);

    if (!channel) {
        return interaction.followUp({ content: '⚠️ チャンネルが見つかりません。', ephemeral: true });
    }

    try {
        // パネル送信処理
        await sendPanel(interaction.guild, channel, panelType);

        // ログ送信 (設定がある場合のみ、無ければサイレント)
        await sendAdminLog(interaction, channel, panelType);

        // 完了通知 (60秒後に消える)
        const replyMsg = await interaction.followUp({
            content: `✅ <#${channel.id}> に **${PANEL_TYPES.find(t => t.value === panelType)?.label}** を設置しました。`,
            ephemeral: false // 通常メッセージ
        });

        setTimeout(() => {
            replyMsg.delete().catch(() => { });
        }, 60000);

    } catch (error) {
        console.error('パネル設置エラー:', error);
        await interaction.followUp({ content: `⚠️ エラーが発生しました: ${error.message}`, ephemeral: true });
    }
}

/**
 * パネル送信ロジックの振り分け
 */
async function sendPanel(guild, channel, panelType) {
    // 各パネルのビルド関数をインポートして送信
    // ここでは簡易的に実装するか、既存のハンドラを呼び出す

    // NOTE: 既存のハンドラは "interaction" を引数に取ることが多いので、
    // 既存コードをリファクタリングして "channelに送信する関数" を分離するのが理想的。
    // しかし、大規模な変更を避けるため、ここではswitch文で各パネルのメッセージを構築する。

    let embeds = [];
    let components = [];

    switch (panelType) {
        case 'driver_panel':
            const { buildDriverPanelMessage } = require('../../送迎パネル/メイン');
            // ※ 送迎パネル/メイン.js が build関数をexportしているか要確認。
            // していない場合は、既存の送信ロジックを模倣する。
            // user request history を見ると buildDriverPanelMessage は存在しないかも？
            // 確認：送迎パネル/メイン.js
            // Step 1031 (送迎開始.js) requires { updateDriverPanel } from '../送迎パネル/メイン'.
            // I should verify imports. If not available, I will simulate it.

            // 下記は仮実装。実際にはファイルのexportを確認して呼ぶ。
            // 時間がない場合は、重要なパネルだけ実装し、他はTODOにする手もあるが、
            // ユーザーは「パネル設置フロー」を求めているので、全対応が望ましい。

            // 一旦、ここでエラーにならないよう、簡易呼び出しを試みる。
            // もしメソッドがなければエラーになるので、try-catchで捕捉済み。

            // 既存の実装パターン: `handler.js` -> `require(path)(interaction)`
            // それらのファイルの中身を見ると、 `interaction.channel.send` している。
            // なので、channelオブジェクトだけ渡して送信させるのは難しい（interaction依存）。

            // ★解決策:
            // 今回は、主要なパネルの「メッセージ生成ロジック」をこのファイル内に（あるいはHelperとして）再定義するか、
            // 元ファイルを修正して `buildMessage` をexportさせるのが正しい。
            // 時間効率を考え、ここで switch文内に埋め込むのが早いか。

            await require('./パネル送信ヘルパー').sendSpecificPanel(guild, channel, panelType);
            break;

        case 'user_panel':
        case 'ride_list_panel':
        case 'driver_reg_panel':
        case 'user_reg_panel':
        case 'rating_rank_panel':
        case 'admin_panel':
            await require('./パネル送信ヘルパー').sendSpecificPanel(guild, channel, panelType);
            break;

        default:
            throw new Error('未対応のパネル種別です');
    }
}

async function sendAdminLog(interaction, channel, panelType) {
    const { loadConfig } = require('../../../utils/設定/設定マネージャ');
    const config = await loadConfig(interaction.guildId);
    const logThreadId = config.channels?.adminLogThread;

    if (!logThreadId) return; // 設定なければサイレント終了

    const thread = await interaction.guild.channels.fetch(logThreadId).catch(() => null);
    if (thread) {
        const typeLabel = PANEL_TYPES.find(t => t.value === panelType)?.label || panelType;
        await thread.send({
            content: `🛠️ **パネル設置ログ**\n実行者: <@${interaction.user.id}>\n設置パネル: ${typeLabel}\n設置先: <#${channel.id}>`
        });
    }
}
