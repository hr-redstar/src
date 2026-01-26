const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const { updateVcState } = require('../../utils/vcStateStore');

/**
 * 送迎チャンネル保存期間延長
 */
module.exports = {
  customId: 'ride|control|sub=extend',
  async execute(interaction, client, parsed) {
    const channelId = interaction.channelId;
    const guildId = interaction.guildId;

    try {
      await interaction.deferUpdate();

      // ステートを更新
      await updateVcState(guildId, channelId, { expiresAt: null });

      const embed = buildPanelEmbed({
        title: '保存期間延長',
        description: 'この送迎チャンネルの自動削除を解除しました（無期限保存）。\n作業完了後は手動で削除してください。',
        type: 'success',
        client
      });

      await interaction.editReply({ embeds: [embed], components: [] });

      // 管理者ログ
      const { loadConfig } = require('../../utils/設定/設定マネージャ');
      const config = await loadConfig(guildId);
      const logThreadId = config.logs?.adminLogThread;
      if (logThreadId) {
        const thread = await interaction.guild.channels.fetch(logThreadId).catch(() => null);
        if (thread) {
          const logEmbed = buildPanelEmbed({
            title: '[管理] 保存期間延長',
            description: `送迎チャンネルの保存期間が無期限に延長されました。\n\n**実行者:** <@${interaction.user.id}>\n**チャンネル:** <#${channelId}>`,
            type: 'info',
            client
          });
          await thread.send({ embeds: [logEmbed] });
        }
      }
    } catch (error) {
      console.error('削除延長エラー:', error);
      await interaction.followUp({ content: '⚠️ エラーが発生しました。', flags: 64 }).catch(() => null);
    }
  }
};
