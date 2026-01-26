// utils/共通/モーダル登録.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const { sendAdminLog } = require('../ログ/管理者ログ');
const { isRegisteredUser, upsertUserRegistration } = require('../ユーザー/ユーザー管理');

module.exports = async function userRegisterModal(interaction) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  const name = interaction.fields.getTextInputValue('name');
  const mark = interaction.fields.getTextInputValue('landmark');

  // 二重登録防止
  const isRegistered = await isRegisteredUser(guildId, userId);
  if (isRegistered) {
    return interaction.reply({
      content: '❌ すでに利用者登録されています。',
      flags: MessageFlags.Ephemeral,
    });
  }

  const data = {
    name,
    mark,
  };

  await upsertUserRegistration(guildId, userId, data);

  await interaction.reply({
    content: '✅ 利用者登録が完了しました。',
    flags: MessageFlags.Ephemeral,
  });

  // 管理者ログ
  const buildPanelEmbed = require('../embed/embedTemplate');
  const logEmbed = buildPanelEmbed({
    title: '利用者登録',
    description: `
**ユーザー** <@${userId}>
**店舗名 / ニックネーム** ${name}
**方面** ${mark}
    `,
    type: 'success',
    client: interaction.client
  });

  await sendAdminLog(interaction.guild, logEmbed);
};
