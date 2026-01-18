// src/bot/handler/登録処理/利用者登録.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');

const logger = require('../../utils/logger');
const { readJson, writeJson } = require('../../utils/ストレージ/ストア共通');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage_ = require('../../utils/embed/panelMessageTemplate');
const interactionTemplate = require('../共通/interactionTemplate');
const { ACK } = interactionTemplate;

// ===== Custom IDs =====
const CID = {
  BTN_REGISTER: 'reg|user|sub=button',
  MODAL_REGISTER: 'reg|user|sub=modal',
  INP_NAME: 'reg|user|input=name',
  INP_ADDRESS: 'reg|user|input=address',
  INP_MARK: 'reg|user|input=mark',
};

// ===== Paths =====
const paths = require('../../utils/ストレージ/ストレージパス');

function normalizeIdList(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(String))];
}
const nowIso = () => new Date().toISOString();

/**
 * 利用者登録パネルのメッセージペイロードを生成
 */
function buildUserRegPanelMessage(guild, client) {
  const botClient = client || guild.client;
  const embed = buildPanelEmbed({
    title: '利用者登録パネル',
    description: `
利用者登録には以下の情報が必要です。
ボタンを押して入力してください。

**店舗名 または ニックネーム**
配車時に表示されるお名前です。

**店舗住所**
お迎えにあがる正確な住所を入力してください。

**駐車目印**
送迎車が停車する際の目印（看板、入口横など）を入力してください。
    `,
    client: botClient,
  });

  if (guild?.iconURL()) embed.setThumbnail(guild.iconURL());

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CID.BTN_REGISTER)
      .setLabel('利用者登録')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ps|check')
      .setLabel('登録状態確認')
      .setStyle(ButtonStyle.Secondary)
  );

  return buildPanelMessage_({ embed, components: [row] });
}

/**
 * ハンドラー実行
 */
async function execute(interaction, parsed) {
  if (!interaction.guildId) return;

  const sub = parsed?.params?.sub;

  // ボタン → モーダル (ACKなしでshowModal)
  if (interaction.isButton() && sub === 'button') {
    const modal = new ModalBuilder().setCustomId(CID.MODAL_REGISTER).setTitle('利用者登録');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_NAME)
          .setLabel('店舗名 または ニックネーム')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_ADDRESS)
          .setLabel('店舗住所')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_MARK)
          .setLabel('駐車目印')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(200)
      )
    );

    return interaction.showModal(modal);
  }

  // モーダル → 保存 (interactionTemplate で ACK 制御)
  if (interaction.isModalSubmit() && sub === 'modal') {
    return interactionTemplate(interaction, {
      ack: ACK.REPLY,
      async run(interaction) {
        const name = interaction.fields.getTextInputValue(CID.INP_NAME)?.trim();
        const address = interaction.fields.getTextInputValue(CID.INP_ADDRESS)?.trim();
        const mark = interaction.fields.getTextInputValue(CID.INP_MARK)?.trim();

        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        // 個別登録情報を履歴付きで保存 (インデックス更新含む)
        const { saveUser } = require('../../utils/usersStore');
        const registrationData = {
          userId,
          storeName: name, // 利用者の場合は storeName
          address,
          mark,
          registeredAt: nowIso(),
        };
        await saveUser(guildId, userId, registrationData);

        // 統計更新
        const { incrementStat } = require('../../utils/ストレージ/統計ストア');
        await incrementStat(guildId, 'user_registered').catch(() => null);

        // メモチャンネル作成 or 検出
        const { loadConfig } = require('../../utils/設定/設定マネージャ');
        const config = await loadConfig(interaction.guild.id);

        if (config.categories?.userMemo) {
          const { findUserMemoChannel } = require('../../utils/findUserMemoChannel');
          const { createUserMemoChannel } = require('../../utils/createUserMemoChannel');

          // 既存チャンネル検出
          let memoChannel = await findUserMemoChannel({
            guild: interaction.guild,
            userId: interaction.user.id,
            categoryId: config.categories.userMemo,
            role: 'user',
          }).catch((err) => {
            console.error('メモチャンネル検出失敗', err);
            return null;
          });

          // 既存チャンネルがあれば再登録処理
          const isReregistration = !!memoChannel;

          if (memoChannel) {
            // 最新のJSON取得（履歴含む）
            const { loadUserFull } = require('../../utils/usersStore');
            const fullJson = await loadUserFull(interaction.guild.id, interaction.user.id);

            // 登録情報メッセージを更新または新規作成
            const { getRegistrationMessageId } = require('../../utils/registrationMessageStore');
            const {
              updateRegistrationInfoMessage,
            } = require('../../utils/updateRegistrationInfoMessage');
            const {
              buildRegistrationInfoMessage,
            } = require('../../utils/buildRegistrationInfoMessage');
            const { saveRegistrationMessageId } = require('../../utils/registrationMessageStore');

            const messageId = await getRegistrationMessageId(
              interaction.guild.id,
              interaction.user.id,
              'user'
            );

            if (messageId) {
              // 既存メッセージを編集
              await updateRegistrationInfoMessage(
                memoChannel,
                messageId,
                fullJson,
                'user',
                interaction.user
              ).catch((err) => {
                console.error('登録情報メッセージ更新失敗', err);
              });
            } else {
              // 初回再登録時: 新規メッセージを作成
              const {
                buildUserRegistrationEmbed,
              } = require('../../utils/buildRegistrationInfoEmbed');

              const embed = buildUserRegistrationEmbed(fullJson, interaction.user);

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
                  'user'
                ).catch((err) => {
                  console.error('メッセージID保存失敗', err);
                });
              }
            }
          } else {
            // なければ新規作成
            memoChannel = await createUserMemoChannel({
              guild: interaction.guild,
              user: interaction.user,
              categoryId: config.categories.userMemo,
              role: 'user',
            }).catch((err) => {
              console.error('メモチャンネル作成失敗', err);
              return null;
            });
          }
        }

        // ロール付与
        const roleIds = config.roles?.users || [];
        if (roleIds.length > 0 && interaction.member) {
          try {
            await interaction.member.roles.add(roleIds);
          } catch (e) {
            logger.warn(`利用者ロール付与失敗: user=${userId}, err=${e.message}`);
          }
        }

        // ログ出力 (運営者ログ)
        const logChId = config.logs?.operatorChannel;
        if (logChId) {
          const ch = await interaction.guild.channels.fetch(logChId).catch(() => null);
          if (ch) {
            const logEmbed = new EmbedBuilder()
              .setTitle('👤 利用者登録')
              .setColor(0x3498db)
              .addFields(
                { name: 'ユーザー', value: `<@${userId}>`, inline: true },
                { name: 'お名前', value: name, inline: true },
                { name: '住所', value: address, inline: false },
                { name: '駐車目印', value: mark, inline: false }
              )
              .setTimestamp();
            await ch.send({ embeds: [logEmbed] }).catch(() => null);
          }
        }

        // パネル更新
        const { updateUserCheckPanel, upsertRegistrationLedger } = require('./ユーザー確認パネル');
        await upsertRegistrationLedger(interaction.guild, 'user', registrationData).catch(() => null);
        await updateUserCheckPanel(interaction.guild, interaction.client).catch(() => null);

        // --- NEW: 履歴まとめ期間の選択を促す ---
        const { StringSelectMenuBuilder } = require('discord.js');
        const policyMenu = new StringSelectMenuBuilder()
          .setCustomId(`reg|user|sub=policy&uid=${userId}`)
          .setPlaceholder('履歴まとめ期間を選択（推奨: 1週間）')
          .addOptions([
            { label: '1週間ごとにまとめる (推奨)', value: '1w', description: '月曜〜日曜の1週間分を1つのスレッドにアーカイブ' },
            { label: '2週間ごとにまとめる', value: '2w' },
            { label: '1ヶ月ごとにまとめる', value: '1m' },
            { label: '半年ごとにまとめる', value: '6m' },
            { label: 'まとめない (毎回新規作成)', value: 'none' },
          ]);

        const policyRow = new ActionRowBuilder().addComponents(policyMenu);

        await interaction.editReply({
          content: '✅ 利用者基本情報の登録が完了しました！\n最後に、**履歴（メモ）のまとめ期間**を選択してください。',
          components: [policyRow],
        });
      },
    });
  }

  // --- NEW: 期間選択ハンドラ ---
  if (sub === 'policy') {
    return interactionTemplate(interaction, {
      ack: ACK.UPDATE,
      async run(interaction) {
        const policy = interaction.values[0];
        const userId = parsed?.params?.uid || interaction.user.id;
        const { loadUserFull, saveUser } = require('../../utils/usersStore');

        const userData = await loadUserFull(interaction.guildId, userId);
        if (userData) {
          userData.threadPolicy = {
            enabled: policy !== 'none',
            period: policy === 'none' ? null : policy,
          };
          await saveUser(interaction.guildId, userId, userData);
        }

        await interaction.editReply({
          content: `✅ 設定を完了しました！\n期間設定: **${getPolicyLabel(policy)}**\nこれですべての登録が完了です。`,
          components: [],
        });
      }
    });
  }
}

function getPolicyLabel(p) {
  const labels = { '1w': '1週間', '2w': '2週間', '1m': '1ヶ月', '6m': '半年', 'none': 'なし' };
  return labels[p] || p;
}

module.exports = { CID, buildUserRegPanelMessage, execute };
