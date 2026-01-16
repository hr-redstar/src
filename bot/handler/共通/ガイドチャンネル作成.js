const { ChannelType, PermissionsBitField } = require('discord.js');

/**
 * ガイド用テキストチャンネルを作成（存在すれば何もしない）
 * @param {Object} options
 * @param {Guild} options.guild - ギルド
 * @param {string} options.categoryId - カテゴリーID
 * @param {string} options.channelName - チャンネル名
 * @param {Function} options.messageBuilder - メッセージ生成関数
 */
async function ensureGuideChannel({
    guild,
    categoryId,
    channelName,
    messageBuilder,
}) {
    if (!guild || !categoryId) return;

    const category = guild.channels.cache.get(categoryId);
    if (!category) return;

    // 既存チェック（最新の状態を取得）
    const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
    let channel = channels.find(
        ch =>
            ch.parentId === categoryId &&
            ch.name.toLowerCase() === channelName.toLowerCase() &&
            ch.type === ChannelType.GuildText
    );

    if (!channel) {
        // チャンネル作成
        channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    allow: [PermissionsBitField.Flags.ViewChannel],
                    deny: [PermissionsBitField.Flags.SendMessages],
                },
            ],
        }).catch(() => null);
    }

    if (!channel) return;

    // メッセージの存在確認（直近50件取得）
    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);

    // ボット自身が送信した最新のメッセージを探す
    const botMessage = messages?.find(m => m.author.id === guild.client.user.id);
    const result = messageBuilder?.(category);

    if (!result) return;

    // content と topic を取得
    const content = result.content || result;
    const topic = result.topic || null;

    // チャンネル説明（トピック）を更新
    if (topic && channel.topic !== topic) {
        await channel.setTopic(topic).catch(() => null);
    }

    if (botMessage) {
        // 既存メッセージを編集
        await botMessage.edit(content).catch(() => null);
    } else {
        // メッセージがない場合は新規送信
        await channel.send(content).catch(() => null);
    }

    return channel.id;
}

module.exports = {
    ensureGuideChannel,
};
