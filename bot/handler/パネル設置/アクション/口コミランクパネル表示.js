const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } = require('discord.js');

const { CUSTOM_ID, requireAdmin, MessageFlags } = require('../共通/_panelSetupCommon');

module.exports = {
  customId: CUSTOM_ID.SEND_RATING_RANK_PANEL,
  type: 'button',
  async execute(interaction) {
    // ① 管理者チェック
    if (!(await requireAdmin(interaction))) return;

    // ② チャンネル選択メニュー作成
    const select = new ChannelSelectMenuBuilder()
      .setCustomId(CUSTOM_ID.SEL_RATING_RANK_PANEL)
      .setPlaceholder('送信先のテキストチャンネルを選択してください')
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(select);

    // ③ 本人にしか見えないメッセージで送信
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { loadConfig } = require('../../../utils/設定/設定マネージャ');
    const config = await loadConfig(interaction.guildId);
    let content = 'どのチャンネルに口コミランクパネルを送信しますか？';
    if (config.panels?.ratingRank?.channelId) {
      content = `⚠️ すでに <#${config.panels.ratingRank.channelId}> に設置されています。\n新しく設置すると、旧パネルメッセージは自動的に削除されます。\n\n設置先を選択してください：`;
    }

    await interaction.editReply({
      content,
      components: [row],
    });
  },
};
