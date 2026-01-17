const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { loadConfig, saveConfig } = require('../../../../utils/設定/設定マネージャ');
const autoInteractionTemplate = require('../../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

const CID = {
  BTN_RANK_TIERS: 'adm|rank_tiers|sub=start',
  MODAL_RANK_TIERS: 'adm|rank_tiers|sub=modal',
};

module.exports = {
  CID,
  /**
   * ボタン押下時：モーダルを表示
   */
  async showModal(interaction, parsed) {
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
  async handleModal(interaction, parsed) {
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.REPLY,
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

        await interaction.editReply({
          content: `✅ ランク階級を登録しました（${tiers.length}階級）。\n\`${tiers.join(' > ')}\``,
        });
      },
    });
  },
};
