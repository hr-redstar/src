const { loadVcState, saveVcState } = require('./vcStateStore');

const DAY = 1000 * 60 * 60 * 24;

module.exports.cleanupExpiredRides = async (client) => {
  for (const guild of client.guilds.cache.values()) {
    const vcState = await loadVcState(guild.id);
    let changed = false;

    for (const [vcId, data] of Object.entries(vcState)) {
      if (!data.endedAt) continue;

      // 無期限 (null) は削除しない
      if (data.expiresAt === null) continue;

      let expired = false;
      if (data.expiresAt) {
        if (Date.now() > new Date(data.expiresAt).getTime()) expired = true;
      } else {
        // Fallback (expiresAtがない古いデータなど)
        const diff = Date.now() - new Date(data.endedAt).getTime();
        if (diff >= DAY * 7) expired = true;
      }

      if (!expired) continue;

      // ログ用スレッド削除
      if (data.logThreadId) {
        const thread = await guild.channels.fetch(data.logThreadId).catch(() => null);
        if (thread) {
          await thread.delete('送迎終了から保存期間経過により自動削除').catch(() => {});
        }
      }

      // メモチャンネル全体は削除しない（他の送迎ログがある可能性があるため）
      // 古い仕様との互換性のため、もし元のVC（送迎チャット）が残っていれば削除
      const vc = await guild.channels.fetch(vcId).catch(() => null);
      if (vc) {
        await vc.delete('送迎終了から保存期間経過により自動削除').catch(() => {});
      }

      delete vcState[vcId];
      changed = true;
    }

    if (changed) {
      await saveVcState(guild.id, vcState);
    }
  }
};
