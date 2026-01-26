// handler/相乗り/却下モーダル.js
const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = {
  execute: async function (interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.REPLY,
      async run(interaction) {
        const rideId = parsed?.params?.r || parsed?.params?.rid;
        const userId = parsed?.params?.u || parsed?.params?.uid;

        // rideId が timestamp_userId_guildId 形式ならそこから抽出
        const guildIdFromRideId = rideId?.split('_')?.[2];
        const guildId = interaction.guildId || parsed?.params?.gid || guildIdFromRideId;
        const guild = interaction.guild || (guildId ? await client.guilds.fetch(guildId).catch(() => null) : null);
        const reason = interaction.fields.getTextInputValue('input|reason');

        if (!guild) return interaction.editReply('❌ サーバー情報が見つかりませんでした。');

        const requester = await guild.members.fetch(userId).catch(() => null);
        if (requester) {
          const embed = buildPanelEmbed({
            title: '相乗りリクエスト却下',
            description: `申し訳ありません、ドライバーによりリクエストが却下されました。\n**理由:** ${reason}`,
            type: 'error',
            client
          });
          await requester.send({ embeds: [embed] }).catch(() => null);
        }

        // ログ出力
        const logEmbed = buildPanelEmbed({
          title: '[管理] 相乗り却下',
          description: `以下の相乗りリクエストが却下されました。`,
          fields: [
            { name: 'ドライバー', value: `<@${interaction.user.id}>`, inline: true },
            { name: '希望者', value: `<@${userId}>`, inline: true },
            { name: '理由', value: reason, inline: false }
          ],
          type: 'error',
          client
        });

        await postOperatorLog({
          guild: guild,
          embeds: [logEmbed],
        }).catch(() => null);


        // 保留中のリクエストを削除 (クリーンアップ)
        const activePath = `${paths.activeDispatchDir(guildId)}/${parsed?.params?.rid}.json`;
        const rideData = await store.readJson(activePath).catch(() => null);
        if (rideData && rideData.pendingCarpoolRequests) {
          delete rideData.pendingCarpoolRequests[userId];
          await store.writeJson(activePath, rideData);
        }

        await interaction.editReply(`✅ 却下しました (理由送信済み)`);
      },
    });
  },
};
