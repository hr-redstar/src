const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { postAdminActionLog } = require('../../../utils/ログ/管理者ログ');
const { loadConfig, saveConfig } = require('../../../utils/設定/設定マネージャ');
const { updateRatingRankPanelMessage } = require('../../管理者パネル/口コミランクパネル構築');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

const CID = {
  BTN_RANK_TIERS: 'adm|rank_tiers|sub=start',
  MODAL_RANK_TIERS: 'adm|rank_tiers|sub=modal',
};

const buildPanelEmbed = require('../../../utils/embed/embedTemplate');

module.exports = {
  CID,

  /**
   * エントリポイント
   */
  async startFlow(interaction, client, parsed) {
    return this.showModal(interaction, client, parsed);
  },

  /**
   * ボタン押下時：モーダルを表示
   */
  async showModal(interaction, client, parsed) {
    const config = await loadConfig(interaction.guildId);
    const modal = new ModalBuilder().setCustomId(CID.MODAL_RANK_TIERS).setTitle('ランク階級登録');

    const tiersInput = new TextInputBuilder()
      .setCustomId('tiers')
      .setLabel('ランク階級（改行区切りで入力）')
      .setPlaceholder('例:\nブロンズ\nシルバー\nゴールド\nプラチナ')
      .setValue(config.ranks?.tiers?.join('\n') || '')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(tiersInput));
    return interaction.showModal(modal);
  },

  /**
   * モーダル送信時：保存
   */
  async handleModal(interaction, client, parsed) {
    // For modal submissions, isModal is always true.
    const isModal = true;
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: isModal ? ACK.NONE : ACK.REPLY,
      panelKey: 'ratingRank',
      async run(interaction) {
        const raw = interaction.fields.getTextInputValue('tiers');
        const tiers = raw
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean);

        const config = await loadConfig(interaction.guildId);
        config.ranks ??= {};
        config.ranks.tiers = tiers;
        await saveConfig(interaction.guildId, config);

        // 口コミランクパネルを更新
        await updateRatingRankPanelMessage(interaction.guild, config, interaction.client);

        await postAdminActionLog({
          guild: interaction.guild,
          user: interaction.user,
          title: 'ランク階級設定更新',
          description: `登録された階級：\n${tiers.join(', ')}`,
        });

        const embed = buildPanelEmbed({
          title: '✅ ランク階級を更新しました',
          description: `合計 **${tiers.length}** 階級を登録しました。\n\n**階級一覧**:\n\`${tiers.join(' > ')}\``,
          color: 0x2ecc71,
          client: interaction.client
        });

        await interaction.editReply({
          embeds: [embed],
        });
      },
    });
  },
};
