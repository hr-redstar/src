// handler/自動設定/guidePanelBuilder.js
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');
const { loadConfig } = require('../../utils/設定/設定マネージャ');

/**
 * 案内パネルのメッセージを生成
 */
async function buildGuidePanelMessage(guild) {
    const config = await loadConfig(guild.id);
    const client = guild.client;

    const title = config.guidePanelTitle || '送迎システムについて';
    const description = config.guidePanelDescription || `### はじめに
「利用者登録」または「送迎者登録」を行ってください。
登録完了後、以下の操作が可能になります。
・利用者：「送迎依頼」
・送迎者：「送迎者出勤」

### マッチングについて
利用者と送迎者がマッチングされると、
専用のボイスチャンネル（連絡用） が自動で作成されます。

このチャンネルは、該当する利用者・送迎者のみが使用できます。

### トラブル・連絡について
ボイスチャンネル内の メッセージ欄 または ボイス通話 で連絡可能です。`;

    // リンク生成
    const makeLink = (p) =>
        p && p.channelId && p.messageId
            ? `📌 <#${p.channelId}> 🔗 [パネルへ](https://discord.com/channels/${guild.id}/${p.channelId}/${p.messageId})`
            : '⚠️ 未設置';

    const embeds = [];

    // 🛡️ メイン案内
    embeds.push(
        buildPanelEmbed({
            title,
            description,
            type: 'info',
            client
        })
    );

    // 📋 各種パネルリンク
    embeds.push(
        buildPanelEmbed({
            title: '📋 各種パネル一覧',
            fields: [
                {
                    name: '👤 ユーザー登録はこちら',
                    value: `・利用者：${makeLink(config.panels?.userRegister)}\n・送迎者：${makeLink(config.panels?.driverRegister)}`,
                },
                {
                    name: '🚗 送迎のご利用はこちら',
                    value: `・利用者：${makeLink(config.panels?.userPanel)}\n・送迎者：${makeLink(config.panels?.driverPanel)}`,
                }
            ],
            type: 'info',
            client
        })
    );

    return buildPanelMessage({ embeds });
}

module.exports = { buildGuidePanelMessage };
