const { ThreadAutoArchiveDuration } = require('discord.js');
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');

/**
 * 問い合わせ送信時の処理（スレッド作成など）
 */
async function handleInquirySubmit(interaction) {
    const guild = interaction.guild;
    const user = interaction.user;
    const title = interaction.fields.getTextInputValue('input|inquiry|title');
    const body = interaction.fields.getTextInputValue('input|inquiry|body');

    const config = await loadConfig(guild.id);
    const operatorLogChId = config.logs?.operatorChannel;

    if (!operatorLogChId) {
        return interaction.editReply('❌ 運営者ログチャンネルが設定されていないため、問い合わせを送信できません。運営にお伝えください。');
    }

    const channel = await guild.channels.fetch(operatorLogChId).catch(() => null);
    if (!channel) {
        return interaction.editReply('❌ 運営者ログチャンネルが見つかりません。');
    }

    try {
        // 1. 問い合わせスレッドの作成
        const threadName = `📩問い合わせ-${user.username}-${title}`.substring(0, 100);
        const thread = await channel.threads.create({
            name: threadName,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
            reason: `問い合わせによる自動作成 (User: ${user.id})`,
        });

        // 2. スレッドの権限設定
        await thread.members.add(user.id);

        // 3. 初期メッセージの送信
        const logEmbed = buildPanelEmbed({
            title: '📩 新規問い合わせ',
            description: [
                `**件名:** ${title}`,
                '',
                body
            ].join('\n'),
            fields: [
                { name: '送信者', value: `<@${user.id}> (${user.id})`, inline: true }
            ],
            type: 'info',
            client: interaction.client,
            thumbnail: user.displayAvatarURL()
        });

        await thread.send({
            content: `🔔 運営者各位：<@${user.id}> 様より問い合わせがありました。\nこのスレッドで対応を行ってください。\n\n<@&${config.operatorRoleId || ''}>`,
            embeds: [logEmbed],
        });

        // 4. ユーザーへの完了通知
        const successEmbed = buildPanelEmbed({
            title: '問い合わせを送信しました',
            description: `専用スレッド <#${thread.id}> を作成しました。\n運営者が確認次第、こちらで返信いたします。`,
            type: 'success',
            client: interaction.client
        });

        return interaction.editReply({ embeds: [successEmbed] });

    } catch (err) {
        console.error('Inquiry creation failed:', err);
        return interaction.editReply(`❌ スレッド作成中にエラーが発生しました: ${err.message}`);
    }
}

module.exports = {
    handleInquirySubmit,
};
