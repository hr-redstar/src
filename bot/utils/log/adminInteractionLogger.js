const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../設定/設定マネージャ');

/**
 * 管理社ログへのインタラクション記録
 * @param {import('discord.js').Interaction} interaction
 * @param {'START'|'ERROR'} phase
 * @param {Object} extra
 */
async function logAdminInteraction(interaction, phase = 'START', extra = {}) {
    // Configから管理者ログスレッドを取得
    const config = await loadConfig(interaction.guildId);
    const threadId = config?.logs?.adminLogThread;
    if (!threadId) return; // 設定がなければ何もしない

    const client = interaction.client;
    const thread = await client.channels.fetch(threadId).catch(() => null);
    if (!thread) return;

    const buildPanelEmbed = require('../../utils/embed/embedTemplate');
    const embed = buildPanelEmbed({
        title: '🛠 Bot 操作ログ',
        color: phase === 'ERROR' ? 0xff0000 : 0x3498db,
        client: client,
        fields: [
            { name: 'ユーザー', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'チャンネル', value: `<#${interaction.channelId}>`, inline: true },
        ]
    });

    embed.addFields({ name: '追跡ID', value: `\`${interaction.id}\``, inline: false });

    if (interaction.isChatInputCommand?.()) {
        embed.addFields({
            name: 'コマンド',
            value: `/${interaction.commandName}`,
            inline: false,
        });
        // オプションがあれば整形して表示
        if (interaction.options?.data?.length > 0) {
            const options = interaction.options.data
                .map((opt) => `${opt.name}: ${opt.value}`)
                .join('\n');
            embed.addFields({ name: 'オプション', value: options });
        }
    }

    if (interaction.isButton?.()) {
        // ボタンのラベルを取得を試みる
        const label = interaction.component?.label || '名前なしボタン';
        embed.addFields({
            name: 'ボタン',
            value: `『${label}』`,
            inline: false,
        });
    }

    if (interaction.isAnySelectMenu?.()) {
        const labels = interaction.component?.options
            ?.filter(opt => interaction.values.includes(opt.value))
            ?.map(opt => opt.label) || [];

        embed.addFields({
            name: 'ℹ️ リスト選択',
            value: `対象: \`${interaction.customId}\`\n選択: **${labels.join(', ') || interaction.values.join(', ')}**`,
            inline: false,
        });
    }

    if (interaction.isModalSubmit?.()) {
        // IDからラベルへのマッピング (v2.9.3 Professional Edition)
        const labelMap = {
            // モーダルID (Prefix対応)
            'reg|user|sub=modal': '『利用者登録』',
            'reg|driver|sub=modal': '『送迎者登録』',
            'driver|return_queue|sub=submit': '『待機復帰入力』',
            'ride|end|sub=submit': '『送迎終了入力』',
            'op|credits|sub=modal': '『ユーザークレジット登録』',
            'op|fee|sub=modal': '『利用料設定』',
            'op|directions|sub=detail_modal': '『方面・方角詳細編集』',
            'driver|on|sub=modal': '『出勤登録』',
            // フィールドID
            'reg|user|input=name': '店舗名・ニックネーム',
            'reg|user|input=address': '店舗住所',
            'reg|user|input=mark': '駐車目印',
            'reg|driver|input=nickname': 'ニックネーム',
            'reg|driver|input=car': '車種/カラー/ナンバー',
            'input|driver|car': '車種/カラー/ナンバー',
            'reg|driver|input=capacity': '乗車人数',
            'input|driver|capacity': '乗車定員',
            'reg|driver|input=whoo': 'whooアカウントID',
            'direction_detail': '詳細テキスト',
            'location': '現在地',
            'input|driver|location': '現在地',
            'destination': '最終目的地',
            'credit_amount': '登録クレジット額',
            'fee_amount': '利用料設定額',
        };

        // Prefix一致を考慮したカスタムID解決
        const fullId = interaction.customId;
        const baseId = Object.keys(labelMap).find(prefix => fullId.startsWith(prefix)) || fullId;
        const modalLabel = labelMap[baseId] || fullId;

        const inputs = [];
        interaction.fields.fields.forEach((field) => {
            const fieldLabel = labelMap[field.customId] || field.customId;
            // バックネスト防止措置: バックチックが含まれる場合はエスケープ
            const safeValue = field.value.replace(/`/g, '`\u200b');
            inputs.push(`**${fieldLabel}**: ${safeValue.slice(0, 500)}`);
        });

        embed.addFields({
            name: 'ℹ️ モーダル送信',
            value: `対象: ${modalLabel}\n${inputs.join('\n')}`,
            inline: false,
        });
    }

    // 補足情報 (エラー内容など)
    if (extra.message) {
        embed.addFields({ name: '補足 / エラー', value: extra.message });
    }

    // フッターは buildPanelEmbed が生成したものを使用 (v2.9.2)

    await thread.send({ embeds: [embed] }).catch((err) => {
        console.error('管理者ログ送信エラー:', err);
    });
}

module.exports = {
    logAdminInteraction,
};
