const { MessageFlags, EmbedBuilder } = require('discord.js');
const { saveDriver } = require('../../utils/driversStore');
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const { createUserMemoChannel } = require('../../utils/createUserMemoChannel');

module.exports = async (interaction) => {
  const area = interaction.fields.getTextInputValue('input|driver|area');
  const nickname = interaction.fields.getTextInputValue('input|driver|nickname');
  const car = interaction.fields.getTextInputValue('input|driver|car');
  const capacity = Number(interaction.fields.getTextInputValue('input|driver|capacity'));

  if (Number.isNaN(capacity)) {
    return interaction.reply({
      content: '❌ 乗車人数は数字で入力してください',
      flags: MessageFlags.Ephemeral,
    });
  }

  const data = {
    userId: interaction.user.id,
    area,
    nickname,
    car,
    capacity,
    registeredAt: new Date().toISOString(),
    active: false,
  };

  await saveDriver(interaction.guild.id, interaction.user.id, data);

  // ロール付与 & ログ送信
  const config = await loadConfig(interaction.guild.id);

  // ロール付与
  if (config.roles?.drivers?.length > 0) {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    await member.roles.add(config.roles.drivers).catch((err) => {
      console.error('ロール付与失敗', err);
    });
  }

  // 運営者ログ送信
  const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
  const embed = new EmbedBuilder()
    .setTitle('🚗 送迎者登録')
    .setColor(0x2ecc71)
    .addFields(
      { name: 'ユーザー', value: `<@${interaction.user.id}>`, inline: true },
      { name: '活動区域', value: area, inline: true },
      { name: '車種', value: car || '未設定', inline: true },
      { name: '乗車人数', value: `${capacity}人`, inline: true },
      { name: 'ニックネーム', value: nickname || '未設定', inline: true }
    )
    .setTimestamp();

  await postOperatorLog({
    guild: interaction.guild,
    embeds: [embed],
  });

  // メモチャンネル作成 or 検出
  if (config.categories?.userMemo) {
    const { findUserMemoChannel } = require('../../utils/findUserMemoChannel');

    // 既存チャンネル検出
    let memoChannel = await findUserMemoChannel({
      guild: interaction.guild,
      userId: interaction.user.id,
      categoryId: config.categories.userMemo,
      role: 'driver',
    }).catch((err) => {
      console.error('メモチャンネル検出失敗', err);
      return null;
    });

    // 既存チャンネルがあれば再登録処理
    const isReregistration = !!memoChannel;

    if (memoChannel) {
      // 最新のJSON取得（履歴含む）
      const { loadDriverFull } = require('../../utils/driversStore');
      const fullJson = await loadDriverFull(interaction.guild.id, interaction.user.id);

      // 登録情報メッセージを更新または新規作成
      const { getRegistrationMessageId } = require('../../utils/registrationMessageStore');
      const {
        updateRegistrationInfoMessage,
      } = require('../../utils/updateRegistrationInfoMessage');
      const { buildRegistrationInfoMessage } = require('../../utils/buildRegistrationInfoMessage');
      const { saveRegistrationMessageId } = require('../../utils/registrationMessageStore');

      const messageId = await getRegistrationMessageId(
        interaction.guild.id,
        interaction.user.id,
        'driver'
      );

      if (messageId) {
        // 既存メッセージを編集
        await updateRegistrationInfoMessage(
          memoChannel,
          messageId,
          fullJson,
          'driver',
          interaction.user
        ).catch((err) => {
          console.error('登録情報メッセージ更新失敗', err);
        });
      } else {
        // 初回再登録時: 新規メッセージを作成
        const { buildDriverRegistrationEmbed } = require('../../utils/buildRegistrationInfoEmbed');

        const embed = buildDriverRegistrationEmbed(fullJson, interaction.user);

        const sentMessage = await memoChannel.send({ embeds: [embed] }).catch((err) => {
          console.error('登録情報メッセージ送信失敗', err);
          return null;
        });

        // メッセージIDを保存
        if (sentMessage) {
          await saveRegistrationMessageId(
            interaction.guild.id,
            interaction.user.id,
            sentMessage.id,
            'driver'
          ).catch((err) => {
            console.error('メッセージID保存失敗', err);
          });
        }
      }
    } else {
      // なければ新規作成
      const { loadDriverFull } = require('../../utils/driversStore');
      const { buildDriverRegistrationEmbed } = require('../../utils/buildRegistrationInfoEmbed');
      const fullJson = await loadDriverFull(interaction.guild.id, interaction.user.id);
      const registrationEmbed = buildDriverRegistrationEmbed(fullJson, interaction.user);

      const createResult = await createUserMemoChannel({
        guild: interaction.guild,
        user: interaction.user,
        categoryId: config.categories.userMemo,
        role: 'driver',
        registrationEmbed,
      }).catch((err) => {
        console.error('メモチャンネル作成失敗', err);
        return null;
      });
      if (createResult) {
        memoChannel = createResult.channel;
      }
    }
  }

  // ユーザー確認パネルを更新
  const { updateUserCheckPanel } = require('../登録処理/ユーザー確認パネル');
  await updateUserCheckPanel(interaction.guild, interaction.client).catch(() => null);

  const link = memoChannel ? `\n\n**あなたの専用メモチャンネル**:\nhttps://discord.com/channels/${interaction.guild.id}/${memoChannel.id}` : '';
  await interaction.reply({
    content: `✅ 送迎者登録が完了しました！${link}`,
    flags: MessageFlags.Ephemeral,
  });
};
