const { EmbedBuilder } = require("discord.js");
const { loadVcState } = require("../utils/vcStateStore");

module.exports = {
    name: "messageCreate",
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return;

        // 軽量化のため、まずはキャッシュやMapで判定したいが、
        // ここでは仕様通りGCS(vcState)をロードして確認 (キャッシュがないため)
        // ※ 頻度が高い場合はオンメモリキャッシュ推奨
        const vcState = await loadVcState(message.guild.id);
        const ride = vcState[message.channel.id];

        // このチャンネルが管理対象のVCでなければ無視
        if (!ride) return;
        if (!ride.memoChannelId) return;

        // 転送先チャンネル/スレッドの決定
        const targetId = ride.logThreadId || ride.memoChannelId;
        const targetCh = await message.guild.channels
            .fetch(targetId)
            .catch(() => null);

        if (!targetCh) return;

        // 添付ファイル分類
        const images = [];
        const files = [];

        for (const attachment of message.attachments.values()) {
            const isImage =
                attachment.contentType?.startsWith("image/") ||
                /\.(png|jpe?g|gif|webp)$/i.test(attachment.name);

            if (isImage) {
                images.push(attachment);
            } else {
                files.push(attachment);
            }
        }

        // Embed生成（テキスト用）
        if (message.content || (images.length === 0 && files.length > 0)) {
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: message.author.tag,
                    iconURL: message.author.displayAvatarURL()
                })
                .setDescription(message.content || (files.length ? "（添付ファイル）" : "内容なし"))
                .setFooter({
                    text: `${message.channel.name} ｜ ${new Date().toLocaleString("ja-JP")}`,
                })
                .setColor(0x3498db) // ログ用カラー
                .setTimestamp();

            await targetCh.send({ embeds: [embed] }).catch(console.error);
        }

        // 画像の転送（1枚ずつ個別Embed）
        for (let i = 0; i < images.length; i++) {
            const imgEmbed = new EmbedBuilder()
                .setTitle(message.author.username)
                .setDescription(`画像${i + 1}`)
                .setImage(images[i].url)
                .setFooter({
                    text: `${message.channel.name} ｜ ${new Date().toLocaleString("ja-JP")}`,
                })
                .setColor(0x3498db)
                .setTimestamp();

            await targetCh.send({ embeds: [imgEmbed] }).catch(console.error);
        }

        // その他ファイル
        if (files.length > 0) {
            const fileList = files
                .map((f) => `📎 [${f.name}](${f.url})`)
                .join("\n");

            await targetCh.send({
                content: `**添付ファイル**\n${fileList}`,
            }).catch(console.error);
        }
    },
};
