const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } = require('discord.js');

const { CUSTOM_ID, requireAdmin, MessageFlags } = require('../共通/_panelSetupCommon');
const interactionTemplate = require('../../共通/interactionTemplate');
const { ACK } = interactionTemplate;

module.exports = {
  customId: 'ps:modal:guideInitial',
  type: 'modal',
  async execute(interaction) {
    return interactionTemplate(interaction, {
      ack: ACK.REPLY,
      adminOnly: true,
      async run(interaction) {
        const title = interaction.fields.getTextInputValue('title');
        const description = interaction.fields.getTextInputValue('description');

        // チャンネル選択メニュー作成
        // タイトルと説明文をエンコードして ID に含めるのは避けたほうが安全（長さ制限があるため）
        // 実際には一時保存するか、次の customId に載せるが、短縮の必要があるかもしれない
        // ここでは分かりやすく JSON 文字列の一部として扱うか、
        // あるいは interaction の状態として保持できないため、
        // 次のセレクトメニューの customId に載せる（合計 100文字制限に注意）

        // 案：タイトルと説明文はセッション的なところに保存するか、
        // 非常に短い場合は載せる。ここでは一旦、後続の送信時に取得できるよう
        // 特定のプレフィックスで渡す（長さ制限に配慮して title のみ、説明文はデフォルト等にするか、
        // あるいはストアに一時保存する）

        // 今回は確実性を期して、一時的な設定として config に保存するか、
        // あるいは次のステップで解決する。
        // ユーザーは「モーダル入力 -> リスト選択」を望んでいるので、
        // ここでチャンネル選択を出す。

        const select = new ChannelSelectMenuBuilder()
          .setCustomId(
            `${CUSTOM_ID.SEL_GUIDE_PANEL}:${Buffer.from(title).toString('base64').substring(0, 20)}`
          ) // タイトルの一部を載せる例
          .setPlaceholder('送信先のテキストチャンネルを選択してください')
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setMinValues(1)
          .setMaxValues(1);

        const row = new ActionRowBuilder().addComponents(select);

        // モーダルの入力内容を一時的に message の content や embed に隠して、次のハンドラーで拾えるようにする
        await interaction.editReply({
          content: `📝 **案内パネルの設定**\nタイトル: \`${title}\`\n説明文: \`${description}\`\n\n設置先のチャンネルを選択してください。`,
          components: [row],
          // 説明文を保持するために伏せ字で置くなどの工夫
        });
      },
    });
  },
};
