const { UserSelectMenuBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { loadConfig, saveConfig } = require('../../../utils/設定/設定マネージャ');
const { postAdminActionLog } = require('../../../utils/ログ/管理者ログ');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

const CID = {
  BTN_RANK_SET: 'adm|rank_set|sub=start',
  SEL_USER: 'adm|rank_set|sub=user_sel',
  SEL_TIER: 'adm|rank_set|sub=tier_sel', // uid が続く想定
};

const buildPanelEmbed = require('../../../utils/embed/embedTemplate');

module.exports = {
  CID,

  async startFlow(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.REPLY,
      panelKey: 'ratingRank',
      async run(interaction) {
        const row = new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder()
            .setCustomId(CID.SEL_USER)
            .setPlaceholder('ランクを設定するユーザーを選択してください')
        );
        await interaction.editReply({
          content: '👤 設定対象のユーザーを選択してください。',
          components: [row],
        });
      }
    });
  },

  /**
   * ユーザー選択後：ランク階級の選択を表示
   */
  async showTierSelect(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.UPDATE,
      async run(interaction) {
        const targetUserId = interaction.values[0];
        const config = await loadConfig(interaction.guildId);
        const tiers = config.ranks?.tiers || [];

        if (tiers.length === 0) {
          return interaction.editReply({
            content: '⚠️ ランク階級が登録されていません。先に「ランク階級登録」を行ってください。',
            components: [],
          });
        }

        const options = tiers.map((t) => ({ label: t, value: t }));
        // 「ランクなし」の選択肢も追加
        options.unshift({ label: '（ランクなし）', value: 'None' });

        const select = new StringSelectMenuBuilder()
          .setCustomId(`${CID.SEL_TIER}&uid=${targetUserId}`)
          .setPlaceholder('付与するランクを選択してください')
          .addOptions(options);

        const row = new ActionRowBuilder().addComponents(select);
        const targetUser = await interaction.guild.members
          .fetch(targetUserId)
          .catch(() => ({ displayName: '不明なユーザー' }));

        await interaction.editReply({
          content: `🎨 **${targetUser.displayName}** への付与ランクを選択してください。`,
          components: [row],
        });
      },
    });
  },

  /**
   * ランク決定：保存
   */
  async handleTierPick(interaction, client, parsed) {
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.UPDATE,
      async run(interaction) {
        const targetUserId = parsed.params.uid;
        const tierName = interaction.values[0];
        const config = await loadConfig(interaction.guildId);
        config.ranks ??= {};
        config.ranks.userRanks ??= {};

        if (tierName === 'None') {
          delete config.ranks.userRanks[targetUserId];
        } else {
          config.ranks.userRanks[targetUserId] = tierName;
        }

        await saveConfig(interaction.guildId, config);

        const targetUser = await interaction.guild.members
          .fetch(targetUserId)
          .catch(() => ({ displayName: targetUserId, user: { id: targetUserId } }));

        await postAdminActionLog({
          guild: interaction.guild,
          user: interaction.user,
          title: 'ランク設定更新',
          description: `ユーザー：<@${targetUserId}>\nランク：**${tierName === 'None' ? 'なし' : tierName}**`,
        });

        const embed = buildPanelEmbed({
          title: '✅ ユーザーランクを更新しました',
          description: `<@${targetUserId}> のランクを **${tierName === 'None' ? '未設定' : tierName}** に更新しました。`,
          color: 0x2ecc71,
          client: interaction.client
        });

        // --- NEW: ユーザーのメモチャンネルに通知 (v2.6.26) ---
        try {
          const { loadUser } = require('../../../utils/usersStore');
          const { createUserMemoChannel } = require('../../../utils/createUserMemoChannel');
          const { EmbedBuilder } = require('discord.js');

          // ユーザーデータをロード（なければ最低限の情報で作成される）
          // ここでregistrationEmbedを送るかどうか迷うが、ランク付与されるなら登録済みと仮定
          // シンプルにランク更新通知のみを送る
          const userData = await loadUser(interaction.guildId, targetUserId);

          // メモチャンネル確保
          const memoChannel = await createUserMemoChannel({
            guild: interaction.guild,
            userId: targetUserId,
            username: targetUser.displayName || targetUser.user.username,
            categoryType: 'user' // ランクは主に利用者のものとしてuserメモへ
          });

          if (memoChannel) {
            const notifEmbed = buildPanelEmbed({
              title: '👑 ランク更新のお知らせ',
              description: `管理者により、あなたのランクが更新されました。\n\n**新ランク:** **${tierName === 'None' ? 'なし' : tierName}**`,
              type: 'info',
              client: interaction.client
            });

            await memoChannel.send({ embeds: [notifEmbed] });
          }
        } catch (e) {
          console.error('ランク更新通知送信エラー:', e);
        }

        // --- NEW: 口コミランクパネルを更新 (v2.8.8) ---
        try {
          const { updateRatingRankPanelMessage } = require('../../管理者パネル/口コミランクパネル構築');
          await updateRatingRankPanelMessage(interaction.guild, config, interaction.client);
        } catch (e) {
          console.error('口コミランクパネル更新エラー:', e);
        }

        await interaction.editReply({
          content: null,
          embeds: [embed],
          components: [],
        });
      },
    });
  },
};
