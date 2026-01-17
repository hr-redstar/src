const {
  ChannelSelectMenuBuilder,
  ActionRowBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const { CUSTOM_ID, requireAdmin, MessageFlags } = require('../共通/_panelSetupCommon');

module.exports = {
  customId: CUSTOM_ID.SEND_GUIDE_PANEL,
  type: 'button',
  async execute(interaction) {
    // ① 管理者チェック
    if (!(await requireAdmin(interaction))) return;

    const { loadConfig } = require('../../../utils/設定/設定マネージャ');
    const config = await loadConfig(interaction.guildId);

    const modal = new ModalBuilder()
      .setCustomId('ps|modal|sub=guideInitial')
      .setTitle('案内パネルの設定');

    const oldDefaultDesc = '送迎システムの各種操作はこちらから行えます。';
    const isOldDesc =
      !config.guidePanelDescription || config.guidePanelDescription === oldDefaultDesc;

    const defaultTitle = config.guidePanelTitle || '送迎システムについて';
    const defaultDesc = isOldDesc
      ? `### はじめに
「利用者登録」または「送迎者登録」を行ってください。
登録完了後、以下の操作が可能になります。
・利用者：「送迎依頼」
・送迎者：「送迎者出勤」

### マッチングについて
利用者と送迎者がマッチングされると、
カテゴリー 【プライベートVCカテゴリー名】 に
専用のボイスチャンネル（連絡用） が自動で作成されます。

このチャンネルは、該当する利用者・送迎者のみが使用できます。

### トラブル・連絡について
以下のような場合は、作成されたプライベートボイスチャンネル内で直接連絡を行ってください。
・車が見つからない
・目印の場所に着いたが見当たらない
・落とし物・忘れ物があった
・その他、送迎中の確認事項

※ボイスチャンネル内の メッセージ欄 または ボイス通話 のどちらでも対応可能です。`
      : config.guidePanelDescription;

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('パネルのタイトル')
      .setPlaceholder('例: 案内パネル')
      .setValue(defaultTitle)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('説明文')
      .setPlaceholder('送迎システムの使い方の説明など')
      .setValue(defaultDesc)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    await interaction.showModal(modal);
  },
};
