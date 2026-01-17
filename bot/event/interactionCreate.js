// src/bot/events/interactionCreate.js
// interaction を handler/handler.js に丸投げするだけの薄いイベント

const { Events } = require('discord.js');
const handler = require('../handler/handler'); // Assuming this is the new handler entry point
const logger = require('../utils/logger');

function oneLineError(err) {
  const fe = typeof logger.formatError === 'function' ? logger.formatError(err) : String(err);
  return String(fe).split('\n')[0];
}

function fullError(err) {
  return typeof logger.formatError === 'function' ? logger.formatError(err) : err;
}

module.exports = {
  name: Events.InteractionCreate,
  once: false,

  async execute(interaction, client) {
    try {
      await handler.handleInteraction(interaction, client);
    } catch (err) {
      // 重要: ここでさらに例外を起こさない（formatError未定義対策）
      logger.error('Interaction処理で例外が発生しました', {
        summary: oneLineError(err),
        customId: interaction.customId ?? null,
        command: interaction.commandName ?? null,
        user: interaction.user ? `${interaction.user.tag}(${interaction.user.id})` : null,
        guildId: interaction.guildId ?? null,
        channelId: interaction.channelId ?? null,
        kind: interaction.isButton?.()
          ? 'button'
          : interaction.isModalSubmit?.()
            ? 'modal'
            : interaction.isStringSelectMenu?.()
              ? 'select'
              : interaction.isChatInputCommand?.()
                ? 'slash'
                : 'other',
      });

      // 詳細はdebugへ（stack含む）
      logger.debug('例外詳細', fullError(err));

      // 追加：管理・運営者へのアラート通知
      if (interaction.guild) {
        const { sendCriticalAlert } = require('../utils/ログ/アラート通知');
        sendCriticalAlert({
          guild: interaction.guild,
          title: 'Interaction処理エラー',
          message: `ユーザー <@${interaction.user.id}> の操作中にエラーが発生しました。`,
          error: err,
          meta: {
            customId: interaction.customId ?? 'N/A',
            user: `${interaction.user.tag} (${interaction.user.id})`,
            type: interaction.isButton?.() ? 'Button' : interaction.isModalSubmit?.() ? 'Modal' : 'Other',
          }
        }).catch(() => { });
      }
    }
  },
};
