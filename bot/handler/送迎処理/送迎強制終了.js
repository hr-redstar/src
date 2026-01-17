const {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    MessageFlags,
} = require("discord.js");
const interactionTemplate = require("../../共通/interactionTemplate");
const { ACK } = interactionTemplate;
const store = require("../../../utils/ストレージ/ストア共通");
const paths = require("../../../utils/ストレージ/ストレージパス");
const logger = require("../../../utils/logger");

// 既存の送迎終了ロジックを再利用するのも手だが、
// 強制終了は特殊フロー(VC削除・強制クリーンアップ)だけ行えれば良いので、簡易実装する。
// 必要に応じて VCコントロール/送迎終了.js のロジックを参照・共通化してもよい。

module.exports = {
    // admin:ride:force_end_menu
    async handleMenu(interaction, client) {
        return interactionTemplate(interaction, {
            ack: ACK.REPLY_EPHEMERAL,
            async run(interaction) {
                const guildId = interaction.guildId;
                const activeDir = paths.activeDispatchDir(guildId);

                // 配車中一覧を取得
                const files = await store.listKeys(activeDir).catch(() => []);
                const jsonFiles = files.filter(f => f.endsWith('.json'));

                if (jsonFiles.length === 0) {
                    return interaction.editReply({ content: "現在、進行中の送迎はありません。" });
                }

                const options = [];
                for (const fileKey of jsonFiles) {
                    const data = await store.readJson(fileKey).catch(() => null);
                    if (!data) continue;

                    // 表示: 【現在地】→【住所：目印】→【目的地】
                    // ※ data の中身は 送迎開始.js で書かれた内容に依存。
                    // data.route = { from, to } などが入っている想定。
                    // passengerId, driverId もある。

                    // 詳細情報の取得 (userProfileなどを読み込むと重いので、data内の情報で完結させる)
                    // もし data に詳細がない場合は、ID表示などで代用

                    const label = `送迎ID: ${data.rideId} | ${data.status}`;
                    // 住所情報が data.route にあるか確認 (標準的には route: { from, to } )
                    const from = data.route?.from || "不明";
                    const to = data.route?.to || "不明";

                    // description に詳細を入れる
                    // 【現在地】→【住所：目印】→【目的地】 というフォーマット指定だが、
                    // "現在地"はドライバーの動的な位置だが、rideデータには "出発地(from)" があるはず。
                    // 利用者登録情報(住所/目印)はここには含まれていない可能性が高いので、
                    // シンプルに from -> to を表示する。

                    const desc = `D:<@${data.driverId}> P:<@${data.passengerId}> | ${from} ➔ ${to}`;

                    options.push({
                        label: label.substring(0, 100),
                        description: desc.substring(0, 100),
                        value: data.rideId,
                    });
                }

                if (options.length === 0) {
                    return interaction.editReply({ content: "有効な送迎データが見つかりませんでした。" });
                }

                const select = new StringSelectMenuBuilder()
                    .setCustomId("admin:ride:force_end_execute")
                    .setPlaceholder("強制終了する送迎を選択してください")
                    .addOptions(options.slice(0, 25)); // 最大25件

                const row = new ActionRowBuilder().addComponents(select);

                await interaction.editReply({
                    content: "強制終了させる送迎を選択してください。\n(選択すると即座に終了処理が行われます)",
                    components: [row],
                });
            }
        });
    },

    // admin:ride:force_end_execute
    async handleExecute(interaction, client) {
        return interactionTemplate(interaction, {
            ack: ACK.UPDATE, // SelectMenu選択後はメッセージ更新で閉じるか、ephemeralならeditReply
            async run(interaction) {
                const rideId = interaction.values[0];
                const guildId = interaction.guildId;

                // 終了処理を実行
                // ここでは簡易的に「ファイル削除」「VC削除」を行う。
                // ログ保存などは通常の送迎終了フローを通さない場合欠落するかもしれないが、
                // 「強制終了」なので "中止" 扱いとして処理する。

                const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
                const rideData = await store.readJson(activePath).catch(() => null);

                if (!rideData) {
                    return interaction.editReply({ content: "指定された送迎データが見つかりませんでした。(既に終了している可能性があります)", components: [] });
                }

                // 1. データ削除 (送迎中フォルダから)
                await store.deleteFile(activePath);

                // 2. VC削除 (もしあれば)
                if (rideData.voiceChannelId) {
                    const channel = await interaction.guild.channels.fetch(rideData.voiceChannelId).catch(() => null);
                    if (channel) {
                        await channel.delete("管理者による送迎強制終了").catch(e => logger.warn(`強制終了VC削除失敗: ${e.message}`));
                    }
                }

                // 3. ログ出力 (運営者ログ)
                const { loadConfig } = require("../../utils/設定/設定マネージャ");
                const config = await loadConfig(guildId);
                if (config.logs?.operatorChannel) {
                    const ch = await interaction.guild.channels.fetch(config.logs.operatorChannel).catch(() => null);
                    if (ch) {
                        const logAuth = interaction.user;
                        await ch.send(`👮 **送迎強制終了**\n実行者: <@${logAuth.id}>\nRideID: \`${rideId}\`\nDriver: <@${rideData.driverId}>\nPassenger: <@${rideData.passengerId}>`).catch(() => null);
                    }
                }

                // 4. パネル更新
                // 送迎一覧パネル更新
                const updateListPanel = require("./一覧パネル更新");
                await updateListPanel(interaction.guild, client).catch(() => null);

                // 必要なら送迎者・利用者パネルも更新すべきだが、今回は一覧パネル更新を優先。

                await interaction.editReply({
                    content: `✅ 送迎(ID: ${rideId}) を強制終了しました。`,
                    components: []
                });
            }
        });
    }
};
