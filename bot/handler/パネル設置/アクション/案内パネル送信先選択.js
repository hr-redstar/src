const { installPanel } = require('../共通/設置テンプレ');
const { updatePanelSetupPanel } = require('../メイン');
const { loadConfig, saveConfig } = require('../../../utils/設定/設定マネージャ');
const interactionTemplate = require("../../共通/interactionTemplate");
const { ACK } = interactionTemplate;

module.exports = {
    customId: 'ps:select:guidePanelChannel',
    type: 'channelSelect',
    async execute(interaction) {
        return interactionTemplate(interaction, {
            ack: ACK.UPDATE,
            adminOnly: true,
            async run(interaction) {
                const channelId = interaction.values[0];
                const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                if (!channel) {
                    return interaction.followUp({ content: '❌ 指定されたチャンネルが見つかりませんでした。', flags: 64 });
                }

                // 前のメッセージのコンテンツから情報を抽出
                const content = interaction.message.content;
                // 多行対応の正規表現
                const titleMatch = content.match(/タイトル: `([\s\S]+?)`/);
                const descMatch = content.match(/説明文: `([\s\S]+?)`[\n\s]+設置先/);

                const title = titleMatch ? titleMatch[1] : '送迎システムについて';
                const description = descMatch ? descMatch[1] : '';

                const guild = interaction.guild;
                const config = await loadConfig(guild.id);

                // カテゴリー名の動的置換
                let categoryDisplay = '**未設定**';
                if (config.categories?.privateVc) {
                    const catChan = await interaction.guild.channels.fetch(config.categories.privateVc).catch(() => null);
                    categoryDisplay = catChan ? `📁 **${catChan.name}**` : '**指定カテゴリー**';
                }

                const finalDescription = description.replace(/【プライベートVCカテゴリー名】/g, categoryDisplay);

                const ok = await installPanel({
                    interaction,
                    panelKey: 'guide', // 統一されたキー
                    panelName: '案内パネル',
                    channel,
                    buildMessage: async () => {
                        const { EmbedBuilder } = require('discord.js');

                        // リンク生成関数
                        const makeLink = (p) =>
                            p && p.channelId && p.messageId
                                ? `📌 <#${p.channelId}> 🔗 [パネルへ](https://discord.com/channels/${guild.id}/${p.channelId}/${p.messageId})`
                                : '⚠️ 未設置';

                        const embeds = [];

                        // メイン案内
                        embeds.push(
                            new EmbedBuilder()
                                .setTitle(title)
                                .setDescription(finalDescription)
                                .setColor(0x3498db)
                        );

                        // 各種パネル一覧
                        embeds.push(
                            new EmbedBuilder()
                                .setTitle('📋 各種パネル一覧')
                                .addFields(
                                    {
                                        name: '👤 ユーザー登録はこちら',
                                        value: `・利用者：${makeLink(config.panels?.userRegister)}\n・送迎者：${makeLink(config.panels?.driverRegister)}`
                                    },
                                    {
                                        name: '🚗 送迎のご利用はこちら',
                                        value: `・利用者：${makeLink(config.panels?.userPanel)}\n・送迎者：${makeLink(config.panels?.driverPanel)}`
                                    }
                                )
                                .setColor(0x2ecc71)
                        );

                        // プライベートVCガイド
                        const helpChId = config.logs?.guideChannel || config.logs?.operatorChannel;
                        if (helpChId) {
                            embeds.push(
                                new EmbedBuilder()
                                    .setTitle('📝 プライベートVCの使い方')
                                    .setDescription(
                                        `送迎がマッチングされた際に、カテゴリーに送迎者と利用者専用の**プライベートVCチャンネル**が自動で作成されます。
待ち合わせや、落とし物のやり取りなどにご利用ください。

**■ ご利用にあたって**
・送迎終了後、**7日間保存**されます
・必要に応じて **「期間延長」ボタン** で保存期間を延長できます

※内容を管理者が無断で閲覧・公開することはありません。

使い方がわからない場合は運営まで：<#${helpChId}>`)
                                    .setColor(0x9b59b6)
                            );
                        }

                        return { embeds };
                    }
                });

                if (ok) {
                    // 最新の内容を設定に保存（次回デフォルト用）
                    const cfg = await loadConfig(guild.id);
                    cfg.guidePanelTitle = title;
                    cfg.guidePanelDescription = description;
                    await saveConfig(guild.id, cfg);

                    await updatePanelSetupPanel(guild);
                    await interaction.followUp({ content: `✅ <#${channel.id}> に **案内パネル** を設置しました。`, flags: 64 });
                } else {
                    await interaction.followUp({ content: `❌ 案内パネルの送信に失敗しました。`, flags: 64 });
                }
            }
        });
    }
};
