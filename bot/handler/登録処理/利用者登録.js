﻿// src/bot/handler/登録処理/利用者登録.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');

const logger = require('../../utils/logger');
const { readJson, writeJson } = require('../../utils/ストレージ/ストア共通');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage_ = require('../../utils/embed/panelMessageTemplate');
const { sendOrUpdatePanel } = require('../共通/パネル送信');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { loadConfig } = require('../../utils/設定/設定マネージャ');
const { saveUser, loadUserFull } = require('../../utils/usersStore');
const { incrementStat } = require('../../utils/ストレージ/統計ストア');
const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
const { createUserMemoChannel } = require('../../utils/createUserMemoChannel');
const { findUserMemoChannel } = require('../../utils/findUserMemoChannel');
const {
  getRegistrationMessageId,
  saveRegistrationMessageId,
} = require('../../utils/registrationMessageStore');
const {
  updateRegistrationInfoMessage,
} = require('../../utils/updateRegistrationInfoMessage');
const {
  buildUserRegistrationEmbed,
} = require('../../utils/buildRegistrationInfoEmbed');
const { updateUserCheckPanel, upsertRegistrationLedger } = require('./ユーザー確認パネル');

// ===== Custom IDs =====
const CID = {
  BTN_REGISTER: 'reg|user|sub=button',
  BTN_CHECK: 'reg|user|sub=check',
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
    title: '利用者登録',
    description: `
・店舗名・ニックネーム
・店舗住所
・駐車目印
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
      .setCustomId(CID.BTN_CHECK)
      .setLabel('登録状態確認')
      .setStyle(ButtonStyle.Secondary)
  );

  return buildPanelMessage_({ embed, components: [row] });
}

/**
 * 利用者登録パネルを更新
 */
async function updateUserRegPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.userRegister;

  if (!panel || !panel.channelId) return;

  const channel = await guild.channels.fetch(panel.channelId).catch(() => null);
  if (!channel) return;

  const newMessageId = await sendOrUpdatePanel({
    channel,
    messageId: panel.messageId,
    buildMessage: () => buildUserRegPanelMessage(guild, client),
    suppressFallback: true,
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    if (!config.panels) config.panels = {};
    if (!config.panels.userRegister) config.panels.userRegister = {};
    config.panels.userRegister.messageId = newMessageId;
    await saveConfig(guild.id, config); // saveConfigはloadConfigからインポート済み
  }
}

/**
 * ハンドラー実行
 */
async function execute(interaction, client, parsed) {
  if (!interaction.guildId) return;

  const sub = parsed?.params?.sub;

  // 登録状態確認
  if (interaction.isButton() && sub === 'check') {
    return autoInteractionTemplate(interaction, {
      ack: ACK.REPLY,
      panelKey: 'userRegister',
      async run(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const fullJson = await loadUserFull(guildId, userId).catch(() => null);

        if (!fullJson || !fullJson.current) {
          return interaction.editReply({ content: '利用者の登録情報が見つかりません。' });
        }

        const embed = buildUserRegistrationEmbed(fullJson, interaction.user);
        return interaction.editReply({ embeds: [embed] });
      }
    });
  }

  // ボタン → モーダル (直接 showModal を呼び出す)
  if (interaction.isButton() && sub === 'button') {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const fullJson = await loadUserFull(guildId, userId).catch(() => null);
    // Handle double-nested current structure (current.current) if exists
    let existing = fullJson?.current || fullJson || {};
    if (existing?.current) {
      existing = existing.current;
    }

    const modal = new ModalBuilder().setCustomId(CID.MODAL_REGISTER).setTitle('利用者登録');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_NAME)
          .setLabel('店舗名・ニックネーム (必須)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50)
          .setPlaceholder('例: キャバクラ〇〇、はなこ')
          .setValue(existing.storeName || existing.name || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_ADDRESS)
          .setLabel('店舗住所')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(100)
          .setPlaceholder('店舗の詳しい住所を入力')
          .setValue(existing.address || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_MARK)
          .setLabel('駐車目印')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(100)
          .setPlaceholder('車両が停まる際の目印（例：〇〇ビル前など）')
          .setValue(existing.mark || '')
      )
    );

    return interaction.showModal(modal);
  }

  // モーダル送信時の処理
  if (interaction.isModalSubmit() && sub === 'modal') {
    return autoInteractionTemplate(interaction, {
      ack: ACK.REPLY,
      async run(interaction) {
        const name = interaction.fields.getTextInputValue(CID.INP_NAME)?.trim() || '未設定';
        const address = interaction.fields.getTextInputValue(CID.INP_ADDRESS)?.trim() || '未設定';
        const mark = interaction.fields.getTextInputValue(CID.INP_MARK)?.trim() || '未設定';

        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        // 個別登録情報を履歴付きで保存 (インデックス更新含む)
        const registrationData = {
          userId,
          storeName: name, // 利用者の場合は storeName
          name: name,      // 互換性のため
          address,         // 住所
          mark,            // 目印
          registeredAt: nowIso(),
        };
        await saveUser(guildId, userId, registrationData);

        // 統計更新
        const { incrementStat } = require('../../utils/ストレージ/統計ストア');
        await incrementStat(guildId, 'user_registered').catch(() => null);

        // メモチャンネル作成 or 検出
        const { loadConfig } = require('../../utils/設定/設定マネージャ');
        const config = await loadConfig(interaction.guild.id);

        let memoChannel = null;
        if (config.categories?.userMemo) {
          const { findUserMemoChannel } = require('../../utils/findUserMemoChannel');
          const { createUserMemoChannel } = require('../../utils/createUserMemoChannel');

          // 既存チャンネル検出
          memoChannel = await findUserMemoChannel({
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
            const userId = interaction.user.id;
            const fullJson = await loadUserFull(interaction.guildId, userId);
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
                interaction.user,
                config.ranks?.userRanks || {}
              ).catch((err) => {
                console.error('登録情報メッセージ更新失敗', err);
              });
            } else {
              // 初回再登録時: 新規メッセージを作成
              const embed = buildUserRegistrationEmbed(fullJson, interaction.user, config.ranks?.userRanks || {});

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
            const userId = interaction.user.id;
            const fullJson = await loadUserFull(interaction.guildId, userId);
            const registrationEmbed = buildUserRegistrationEmbed(fullJson, interaction.user, config.ranks?.userRanks || {});

            const createResult = await createUserMemoChannel({
              guild: interaction.guild,
              user: interaction.user,
              categoryId: config.categories.userMemo,
              role: 'user',
              registrationEmbed, // v2.6.4
            }).catch((err) => {
              console.error('メモチャンネル作成失敗', err);
              return null;
            });

            if (createResult) {
              memoChannel = createResult.channel;
              if (createResult.registrationMessage) {
                await saveRegistrationMessageId(
                  interaction.guild.id,
                  interaction.user.id,
                  createResult.registrationMessage.id,
                  'user'
                ).catch((err) => {
                  console.error('メッセージID保存失敗', err);
                });
              }
            }
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
            const logEmbed = buildPanelEmbed({
              title: '[管理] 利用者登録受付',
              description: [
                `利用者の登録申請を受理しました。`,
                '',
                `👤 ユーザー: <@${userId}>`,
                `🏠 お名前: **${name}**`,
                `📍 住所/方面: **${address}**`
              ].join('\n'),
              type: 'info',
              client: interaction.client
            });
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

        if (memoChannel) {
          const link = `https://discord.com/channels/${interaction.guild.id}/${memoChannel.id}`;

          // メモチャンネルに通知＆ポリシー設定メニューを送信
          await memoChannel.send({
            content: '✅ 利用者基本情報の登録が完了しました！\n続けて、以下のメニューから**履歴（メモ）のまとめ期間**を選択してください。',
            components: [policyRow],
          });

          // Ephemeralメッセージ: 完了通知と誘導のみ
          await interaction.editReply({
            content: `✅ 登録が完了しました！\n\n**あなたの専用メモチャンネル**:\n${link}\n\n👆 上記チャンネルに移動して、履歴のまとめ期間を設定してください。`,
            components: [],
          });
        } else {
          await interaction.editReply({
            content: '✅ 登録が完了しました！',
            components: [],
          });
        }
      },
    });
  }

  if (sub === 'policy') {
    return autoInteractionTemplate(interaction, {
      ack: ACK.NONE,
      async run(interaction) {
        const policy = interaction.values[0];
        const userId = parsed?.params?.uid || interaction.user.id;

        const userData = await loadUserFull(interaction.guildId, userId);
        if (userData) {
          userData.threadPolicy = {
            enabled: policy !== 'none',
            period: policy === 'none' ? null : policy,
          };
          await saveUser(interaction.guildId, userId, userData);
        }

        await interaction.update({
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

module.exports = { CID, buildUserRegPanelMessage, updateUserRegPanel, execute };
