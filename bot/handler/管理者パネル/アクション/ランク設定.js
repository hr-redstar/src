const {
  ActionRowBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
} = require('discord.js');
const interactionTemplate = require('../../共通/interactionTemplate');
const { ACK } = interactionTemplate;
const { loadRanks, setUserRank } = require('../../../utils/ranksStore');
const { loadDriver } = require('../../../utils/driversStore');
const { loadUser } = require('../../../utils/usersStore');

module.exports = {
  customId: 'adm|rank_set|sub=start',
  type: 'button',
  async execute(interaction, parsed) {
    return interactionTemplate(interaction, {
      ack: ACK.REPLY,
      adminOnly: true,
      async run(interaction) {
        // ユーザー選択メニュー
        const select = new UserSelectMenuBuilder()
          .setCustomId('adm|rank_set|sub=user_sel')
          .setPlaceholder('ランクを設定するユーザーを選択')
          .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(select);
        await interaction.editReply({
          content: 'ランクを設定するユーザーを選択してください。',
          components: [row],
        });
      },
    });
  },
};

/**
 * ユーザー選択時の処理 -> ランク選択メニュー表示
 */
module.exports.handleUserSelect = async function (interaction, parsed) {
  return interactionTemplate(interaction, {
    ack: ACK.UPDATE,
    adminOnly: true,
    async run(interaction) {
      const userId = interaction.values[0];
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      const user = member
        ? member.user
        : await interaction.client.users.fetch(userId).catch(() => null);

      // ロール判定
      let role = 'driver';
      let profile = await loadDriver(interaction.guildId, userId);
      if (!profile) {
        role = 'user';
        profile = await loadUser(interaction.guildId, userId);
      }
      if (!profile) {
        return interaction.editReply({ content: `❌ 未登録のユーザーです。`, components: [] });
      }

      // ランク一覧取得
      const ranks = await loadRanks(interaction.guildId);
      if (ranks.length === 0) {
        return interaction.editReply({
          content: '❌ ランク階級が登録されていません。先に「ランク階級登録」を行ってください。',
          components: [],
        });
      }

      // ランク選択メニュー
      const options = ranks.map((r) => new StringSelectMenuOptionBuilder().setLabel(r).setValue(r));
      // 現在のランクをデフォルトにする
      if (profile.rank && ranks.includes(profile.rank)) {
        options.find((o) => o.data.value === profile.rank).setDefault(true);
      }
      // 解除オプション
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel('ランクなし（解除）')
          .setValue('none')
          .setDescription('現在のランクを削除します')
      );

      const select = new StringSelectMenuBuilder()
        .setCustomId(`adm|rank_set|sub=tier_sel&role=${role}&uid=${userId}`)
        .setPlaceholder('設定するランクを選択')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(select);

      await interaction.editReply({
        content: `**${user ? user.tag : userId}** (${role === 'driver' ? '送迎者' : '利用者'}) のランク設定`,
        components: [row],
        embeds: [],
      });
    },
  });
};

/**
 * ランク選択時の処理 -> 保存
 */
module.exports.handleRankSelect = async function (interaction, parsed) {
  return interactionTemplate(interaction, {
    ack: ACK.UPDATE,
    adminOnly: true,
    async run(interaction) {
      const role = parsed.params.role;
      const userId = parsed.params.uid;
      const rank = interaction.values[0];
      const rankToSave = rank === 'none' ? null : rank;

      await setUserRank(interaction.guildId, userId, role, rankToSave);

      const user = await interaction.client.users.fetch(userId).catch(() => null);
      const userName = user ? user.tag : userId;

      await interaction.editReply({
        content: `✅ **${userName}** のランクを **${rankToSave || 'なし'}** に設定しました。`,
        components: [],
      });
    },
  });
};
