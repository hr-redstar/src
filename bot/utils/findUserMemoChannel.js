const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { postOperatorLog } = require('./ログ/運営者ログ');

/**
 * ユーザーメモチャンネルを検出する
 * 1. 新形式Topic検出（USER_ID=xxx）
 * 2. 旧形式Topic検出（user-memo:xxx）
 * 3. メッセージ履歴確認（fallback）
 * 4. 複数見つかった場合は整理
 */
async function findUserMemoChannel({ guild, userId, categoryId, role = 'driver' }) {
    const foundChannels = [];

    // 方法1: 新形式Topic検出（USER_ID=xxx）
    const byNewTopic = guild.channels.cache.filter(
        ch =>
            ch.type === 0 && // ChannelType.GuildText
            ch.parentId === categoryId &&
            ch.topic?.includes(`USER_ID=${userId}`)
    );
    foundChannels.push(...byNewTopic.values());

    // 方法2: 旧形式Topic検出（fallback）
    if (foundChannels.length === 0) {
        const byOldTopic = guild.channels.cache.filter(
            ch =>
                ch.type === 0 &&
                ch.parentId === categoryId &&
                ch.topic === `user-memo:${userId}`
        );
        foundChannels.push(...byOldTopic.values());
    }

    // 方法3: メッセージ履歴確認（fallback - 最も遅い）
    if (foundChannels.length === 0) {
        const channels = guild.channels.cache.filter(channel =>
            channel.parentId === categoryId &&
            channel.isTextBased()
        );

        for (const channel of channels.values()) {
            try {
                const messages = await channel.messages.fetch({ limit: 10 });
                const found = messages.find(msg =>
                    msg.author.bot &&
                    msg.content.includes(`ユーザーID：${userId}`)
                );
                if (found) {
                    foundChannels.push(channel);
                }
            } catch {
                continue;
            }
        }
    }

    // 見つからなかった
    if (foundChannels.length === 0) {
        return null;
    }

    // 1件のみ見つかった
    if (foundChannels.length === 1) {
        const channel = foundChannels[0];

        // Topicを最新の説明文に更新
        const { buildUserMemoTopic } = require('./buildUserMemoTopic');
        const newTopic = buildUserMemoTopic(userId);
        if (channel.topic !== newTopic) {
            await channel.setTopic(newTopic).catch(() => { });
        }

        return channel;
    }

    // 複数件見つかった → 整理
    const primaryChannel = selectPrimaryMemoChannel(foundChannels);

    // 管理者通知
    await notifyDuplicateChannels({
        guild,
        userId,
        role,
        foundChannels,
        primaryChannel,
    });

    // 非メインチャンネルをアーカイブ化
    for (const channel of foundChannels) {
        if (channel.id === primaryChannel.id) continue;

        await archiveOldMemoChannel(channel, userId).catch(err => {
            console.error(`アーカイブ化失敗: ${channel.id}`, err);
        });
    }

    // Topicを最新の説明文に更新
    const { buildUserMemoTopic } = require('./buildUserMemoTopic');
    const newTopic = buildUserMemoTopic(userId);
    if (primaryChannel.topic !== newTopic) {
        await primaryChannel.setTopic(newTopic).catch(() => { });
    }

    return primaryChannel;
}

/**
 * 複数チャンネルから最新のものを選定
 */
function selectPrimaryMemoChannel(channels) {
    return channels.sort((a, b) => {
        const aTime = a.lastMessage?.createdTimestamp ?? 0;
        const bTime = b.lastMessage?.createdTimestamp ?? 0;
        return bTime - aTime;
    })[0];
}

/**
 * 古いメモチャンネルをアーカイブ化
 */
async function archiveOldMemoChannel(channel, userId) {
    const newName = channel.name.includes('｜old')
        ? channel.name
        : `${channel.name}｜old`;

    await channel.edit({
        name: newName,
        topic: `${channel.topic ?? ''}\nARCHIVED=true`,
        permissionOverwrites: [
            ...channel.permissionOverwrites.cache.values(),
            {
                id: userId,
                deny: [PermissionFlagsBits.SendMessages],
            },
        ],
    });
}

/**
 * 管理者へ重複チャンネル検出を通知（情報ログ）
 */
async function notifyDuplicateChannels({ guild, userId, role, foundChannels, primaryChannel, changedFields = null }) {
    const user = await guild.members.fetch(userId).catch(() => null);
    if (!user) return;

    const roleLabel = role === 'driver' ? '送迎者' : '利用者';
    const archivedList = foundChannels
        .filter(ch => ch.id !== primaryChannel.id)
        .map(ch => ch.name)
        .join(', ');

    const embed = new EmbedBuilder()
        .setTitle('🔁 再登録検出ログ')
        .setDescription('ℹ️ 再登録は常に許可されています。これは情報ログです。')
        .addFields(
            { name: 'ユーザー', value: `${user.user.tag} (${userId})` },
            { name: '登録区分', value: roleLabel },
        )
        .setTimestamp()
        .setColor(0x3498db); // 情報カラー（青）

    // 変更項目がある場合は表示
    if (changedFields && changedFields.length > 0) {
        embed.addFields({
            name: '変更項目',
            value: changedFields.join(', '),
            inline: true
        });
    } else {
        embed.addFields({
            name: '変更可能性',
            value: '車種／区域／入力修正 等',
            inline: true
        });
    }

    embed.addFields(
        { name: '詳細確認', value: `メモチャンネル <#${primaryChannel.id}> を参照`, inline: true }
    );

    if (foundChannels.length > 1) {
        embed.addFields({
            name: '検出メモ数',
            value: String(foundChannels.length),
            inline: true
        });

        if (archivedList) {
            embed.addFields({ name: '整理対象', value: archivedList });
        }
    }

    await postOperatorLog({
        guild,
        embeds: [embed],
    });
}

module.exports = {
    findUserMemoChannel,
};
