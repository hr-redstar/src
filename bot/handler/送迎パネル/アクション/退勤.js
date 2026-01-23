﻿﻿﻿// handler/送迎パネル/アクション/退勤.js
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');

const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = async function (interaction, client, parsed) {
  return autoInteractionTemplate(interaction, {
    ack: ACK.REPLY, // Ephemeral reply
    async run(interaction) {
      const guildId = interaction.guildId;
      const userId = interaction.user.id;

      // 1. 送迎中か確認（送迎中は退勤できない）
      const activeDir = paths.activeDispatchDir(guildId);
      const activeFiles = await store.listKeys(activeDir).catch(() => []);
      let isDriving = false;
      for (const file of activeFiles) {
        if (!file.endsWith('.json')) continue;
        const data = await store.readJson(file).catch(() => null);
        if (data && data.driverId === userId) {
          isDriving = true;
          break;
        }
      }

      if (isDriving) {
        return interaction.editReply({ content: '⚠️ 現在送迎中のため、退勤できません。\n送迎を完了または強制終了してから退勤してください。' });
      }

      // 強制退勤ユーティリティを流用（自分自身で実行）
      const forceOffDriver = require('../../../utils/attendance/forceOffDriver');
      const { profile, wasWaiting } = await forceOffDriver({
        guild: interaction.guild,
        driverId: userId,
        executor: interaction.user,
      });

      if (!profile) {
        return interaction.editReply({
          content: '送迎者登録が見つかりません。先に登録してください。',
        });
      }

      // 3. 結果に応じて返信
      const { postOperatorLog } = require('../../../utils/ログ/運営者ログ');
      const { getQueue } = require('../../../utils/配車/待機列マネージャ');
      const queue = await getQueue(guildId);
      const activeCount = queue.length;

      if (wasWaiting) {
        // グローバルログ送信
        const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
        const embed = buildPanelEmbed({
          title: '🛑 送迎車 退勤通知',
          description: `送迎車が一台退勤しました。\n現在の待機台数：**${activeCount}** 台`,
          color: 0xe74c3c,
          client: interaction.client
        });

        await postOperatorLog({
          guild: interaction.guild,
          content: '【退勤】送迎車がオフラインになりました。',
          embeds: [embed],
        }).catch(() => null);

        // ユーザーへの通知 (Ephemeral)
        return interaction.editReply({ content: 'お疲れ様でした。退勤しました。' });
      } else {
        // 待機列にいない場合（送迎直後でアイドル状態、または未出勤）。
        // いずれの場合も「退勤済み」の状態であることを確認する応答を返すのが親切なため、成功として扱う。
        return interaction.editReply({ content: 'お疲れ様でした。退勤しました。' });
      }
    },
  });
};
