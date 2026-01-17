const { UserSelectMenuBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { loadConfig, saveConfig } = require('../../../../utils/設定/設定マネージャ');
const autoInteractionTemplate = require('../../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

const CID = {
  BTN_RANK_SET: 'adm|rank_set|sub=start',
  SEL_USER: 'adm|rank_set|sub=user_sel',
  SEL_TIER: 'adm|rank_set|sub=tier_sel', // uid が続く想定
};

module.exports = {
  CID,

  /**
   * ボタン押下：ユーザー選択を表示
   */
  async startFlow(interaction) {
    const row = new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CID.SEL_USER)
        .setPlaceholder('ランクを設定するユーザーを選択してください')
    );
    return interaction.reply({
      content: '👤 設定対象のユーザーを選択してください。',
      components: [row],
      ephemeral: true,
    });
  },

  /**
   * ユーザー選択後：ランク階級の選択を表示
   */
  async showTierSelect(interaction) {
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
  async handleTierPick(interaction, targetUserId, tierName) {
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.UPDATE,
      async run(interaction) {
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
          .catch(() => ({ displayName: targetUserId }));
        await interaction.editReply({
          content: `✅ **${targetUser.displayName}** のランクを **${tierName === 'None' ? '未設定' : tierName}** に更新しました。`,
          components: [],
        });
      },
    });
  },
};
