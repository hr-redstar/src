const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

/**
 * 問い合わせモーダルの表示
 */
async function showInquiryModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('inquiry|submit')
        .setTitle('運営者への問い合わせ');

    const titleInput = new TextInputBuilder()
        .setCustomId('input|inquiry|title')
        .setLabel('件名（短く）')
        .setPlaceholder('例：登録情報の修正について')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

    const bodyInput = new TextInputBuilder()
        .setCustomId('input|inquiry|body')
        .setLabel('お問い合わせ内容')
        .setPlaceholder('詳細内容を入力してください。\n送信すると運営者へ通知され、専用スレッドが作成されます。')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(bodyInput)
    );

    await interaction.showModal(modal);
}

module.exports = {
    showInquiryModal,
};
