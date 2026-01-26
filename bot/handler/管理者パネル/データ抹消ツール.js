// handler/管理者パネル/データ抹消ツール.js
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

/**
 * 特定ユーザーの全データを物理抹消する（不可逆操作）
 */
async function executeWipe(interaction, client, targetUserId) {
    return autoInteractionTemplate(interaction, {
        adminOnly: true,
        ack: ACK.AUTO,
        async run(interaction) {
            const guildId = interaction.guildId;
            const guild = interaction.guild;

            let logs = [];

            // 1. 利用者データ
            const userProfile = paths.userProfileJson(guildId, targetUserId);
            if (await store.exists(userProfile)) {
                await store.deleteFile(userProfile).catch(() => null);
                logs.push('✅ 利用者プロファイルを削除');
            }

            // 2. 送迎者データ
            const driverProfile = paths.driverProfileJson(guildId, targetUserId);
            if (await store.exists(driverProfile)) {
                await store.deleteFile(driverProfile).catch(() => null);
                logs.push('✅ 送迎者プロファイルを削除');
            }

            // 3. 待機列からの強制削除
            const { removeFromQueue } = require('../../utils/配車/待機列マネージャ');
            await removeFromQueue(guildId, targetUserId).catch(() => null);
            logs.push('✅ 待機列から削除');

            // 4. メモチャンネルの削除
            const config = await require('../../utils/設定/設定マネージャ').loadConfig(guildId);
            const memoCategory = config.categories?.userMemo;
            if (memoCategory) {
                const category = await guild.channels.fetch(memoCategory).catch(() => null);
                if (category) {
                    const channels = category.children.cache || (await category.fetch()).children.cache;
                    const targetMemo = channels.find(c => c.name.includes(targetUserId));
                    if (targetMemo) {
                        await targetMemo.delete('データ抹消による削除').catch(() => null);
                        logs.push('✅ メモチャンネルを削除');
                    }
                }
            }

            // 5. インデックス（利用者 / 送迎者）の同期は次回の診断時に任せる

            const resultMessage = [
                `🗑️ **ユーザー抹消完了**: <@${targetUserId}> (\`${targetUserId}\`)`,
                '',
                logs.length > 0 ? logs.join('\n') : '削除対象のデータは見つかりませんでした。',
                '',
                '※整合性維持のため、この後に「システム診断」の実行を推奨します。'
            ].join('\n');

            await interaction.editReply({
                content: resultMessage,
                components: []
            });
        }
    });
}

module.exports = { executeWipe };
