// handler/共通/autoInteractionTemplate.js
// v1.6.1 (Reliability Standard)

const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const logger = require('../../utils/logger');

const ACK = {
  AUTO: 'auto', // = deferReply
  NONE: 'none',
};

const active = new Set();

async function autoInteractionTemplate(interaction, options) {
  // Slash Command 等、customId がないインタラクションはここで無視（または個別に処理）
  if (!interaction.customId) {
    if (typeof options.run === 'function') {
      return options.run(interaction);
    }
    return;
  }

  const { ack = ACK.AUTO, adminOnly = false, run } = options;

  if (active.has(interaction.id)) return;
  active.add(interaction.id);

  try {
    // ===== 1. 即時 ACK (3秒ルール対策) =====
    // 何らかの重い処理（管理者判定のDBロード等）の前に必ず deferReply する。
    // deferUpdate は editReply との相性やパネルの秘匿性管理の観点から使用しない方針。
    // ⚠️ ただし、モーダル（showModal）を表示する場合は defer してはいけない
    const isModalTrigger = interaction.customId?.includes('dest_modal_trigger');
    if (ack !== ACK.NONE && !isModalTrigger && !interaction.replied && !interaction.deferred) {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });
    }

    // ===== 2. 管理者権限 / 運営者権限 =====
    if (adminOnly) {
      const { loadConfig } = require('../../utils/設定/設定マネージャ');
      const cfg = await loadConfig(interaction.guildId).catch(() => ({}));
      const operatorRoleId = cfg.operatorRoleId;

      const isSytemAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
      const isOperator = operatorRoleId && interaction.member.roles.cache.has(operatorRoleId);

      if (!isSytemAdmin && !isOperator) {
        const msg = '⚠️ この操作は運営者または管理者専用です。';
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.editReply({ content: msg });
        }
        return;
      }
    }

    // ===== 3. 本処理 =====
    await run(interaction);

  } catch (error) {
    logger.error('💥 autoInteractionTemplate error', error);

    try {
      const msg = '❌ 処理中にエラーが発生しました。';
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.editReply({ content: msg });
      }
    } catch (_) { }
  } finally {
    active.delete(interaction.id);
    setTimeout(() => active.delete(interaction.id), 5000);
  }
}

module.exports = autoInteractionTemplate;
module.exports.ACK = ACK;
