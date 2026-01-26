﻿// src/bot/handler/登録処理/送迎者登録.js
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
const { saveDriver, loadDriverFull } = require('../../utils/driversStore');
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
  buildDriverRegistrationEmbed,
} = require('../../utils/buildRegistrationInfoEmbed');
const { updateUserCheckPanel, upsertRegistrationLedger } = require('./ユーザー確認パネル');

// ===== Custom IDs =====
const CID = {
  BTN_REGISTER: 'reg|driver|sub=button',
  BTN_CHECK: 'reg|driver|sub=check',
  MODAL_REGISTER: 'reg|driver|sub=modal',
  INP_NICKNAME: 'reg|driver|input=nickname',
  INP_CAR: 'reg|driver|input=car',
  INP_CAPACITY: 'reg|driver|input=capacity',
  INP_WHOO: 'reg|driver|input=whoo',
};

// ===== Paths =====
const paths = require('../../utils/ストレージ/ストレージパス');

const nowIso = () => new Date().toISOString();

/**
 * 送迎者登録パネルのメッセージペイロードを生成
 */
function buildDriverRegPanelMessage(guild, client) {
  const botClient = client || guild.client;
  const embed = buildPanelEmbed({
    title: '送迎者登録パネル',
    description: `
送迎者登録
・ニックネーム
・車種/カラー/ナンバー
・乗車人数
・whooアカウントID
    `,
    client: botClient,
  });

  if (guild?.iconURL()) embed.setThumbnail(guild.iconURL());

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CID.BTN_REGISTER)
      .setLabel('送迎者登録')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CID.BTN_CHECK)
      .setLabel('登録状態確認')
      .setStyle(ButtonStyle.Secondary)
  );

  return buildPanelMessage_({ embed, components: [row] });
}

/**
 * 送迎者登録パネルを更新
 */
async function updateDriverRegPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.driverRegister;

  if (!panel || !panel.channelId) return;

  const channel = await guild.channels.fetch(panel.channelId).catch(() => null);
  if (!channel) return;

  const newMessageId = await sendOrUpdatePanel({
    channel,
    messageId: panel.messageId,
    buildMessage: () => buildDriverRegPanelMessage(guild, client),
    suppressFallback: true,
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    if (!config.panels) config.panels = {};
    if (!config.panels.driverRegister) config.panels.driverRegister = {};
    config.panels.driverRegister.messageId = newMessageId;
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
      panelKey: 'driverRegister',
      async run(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const fullJson = await loadDriverFull(guildId, userId).catch(() => null);

        if (!fullJson || !fullJson.current) {
          return interaction.editReply({ content: '送迎者の登録情報が見つかりません。' });
        }

        const embed = buildDriverRegistrationEmbed(fullJson, interaction.user);
        return interaction.editReply({ embeds: [embed] });
      }
    });
  }

  // ボタン → モーダル
  if (interaction.isButton() && sub === 'button') {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const fullJson = await loadDriverFull(guildId, userId).catch(() => null);
    // Handle double-nested current structure (current.current) if exists
    let existing = fullJson?.current || fullJson || {};
    if (existing?.current) {
      existing = existing.current;
    }

    const modal = new ModalBuilder().setCustomId(CID.MODAL_REGISTER).setTitle('送迎者登録');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_NICKNAME)
          .setLabel('ニックネーム (必須)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30)
          .setValue(existing.nickname || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_CAR)
          .setLabel('車種/カラー/ナンバー (必須)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50)
          .setPlaceholder('例: プリウス/白/12-34')
          .setValue(existing.car || '')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_CAPACITY)
          .setLabel('乗車人数 (1-6人)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(1)
          .setValue(existing.capacity ? String(existing.capacity) : '4')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_WHOO)
          .setLabel('whooアカウントID (必須)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
          .setValue(existing.whooId || '')
      )
    );

    return interaction.showModal(modal);
  }

  // モーダル → 保存
  if (interaction.isModalSubmit() && sub === 'modal') {
    return autoInteractionTemplate(interaction, {
      ack: ACK.REPLY,
      async run(interaction) {
        // 設定読み込み (ロール・ログ用)
        const config = await loadConfig(interaction.guildId);

        const nickname = interaction.fields.getTextInputValue(CID.INP_NICKNAME)?.trim();
        const car = interaction.fields.getTextInputValue(CID.INP_CAR)?.trim();
        const capRaw = interaction.fields.getTextInputValue(CID.INP_CAPACITY)?.trim();
        const whooId = interaction.fields.getTextInputValue(CID.INP_WHOO)?.trim();

        const capacity = Number.parseInt(capRaw, 10);
        if (!Number.isFinite(capacity) || capacity <= 0 || capacity > 6) {
          return interaction.editReply({
            content: '⚠️ 乗車人数は 1〜6 の数字で入力してください。',
          });
        }

        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        // データ保存履歴付き (インデックス更新含む)
        const driverData = {
          userId,
          nickname,
          car,
          capacity,
          whooId,
          registeredAt: nowIso(),
          active: false, // 初期状態
        };

        await saveDriver(guildId, userId, driverData);

        // 統計更新
        const { incrementStat } = require('../../utils/ストレージ/統計ストア');
        await incrementStat(guildId, 'driver_registered').catch(() => null);

        // ロール付与
        const roleIds = config.roles?.drivers || [];
        if (roleIds.length > 0 && interaction.member) {
          try {
            await interaction.member.roles.add(roleIds);
          } catch (e) {
            logger.warn(`送迎者ロール付与失敗: user=${userId}, err=${e.message}`);
          }
        }

        // ログ出力 (運営者ログ)
        const { postOperatorLog } = require('../../utils/ログ/運営者ログ');
        const logEmbed = buildPanelEmbed({
          title: '[管理] 送迎者登録受付',
          description: [
            `送迎者の登録申請を受理しました。`,
            '',
            `👤 ユーザー: <@${userId}>`,
            `🏷️ ニックネーム: **${nickname}**`,
            `🚗 車種等: **${car}**`,
            `👥 乗車可能人数: **${capacity}人**`,
            `🆔 whooID: **${whooId}**`
          ].join('\n'),
          type: 'info',
          client
        });

        await postOperatorLog({
          guild: interaction.guild,
          embeds: [logEmbed],
        });

        // チャンネル作成 or 検出 (メモチャンネル)
        let memoChannel = null;
        if (config.categories?.userMemo) {
          memoChannel = await findUserMemoChannel({
            guild: interaction.guild,
            userId: interaction.user.id,
            categoryId: config.categories.userMemo,
            role: 'driver',
          }).catch(() => null);

          if (memoChannel) {
            const userId = interaction.user.id;
            const fullJson = await loadDriverFull(interaction.guildId, userId);
            const messageId = await getRegistrationMessageId(interaction.guildId, userId, 'driver');
            if (messageId) {
              await updateRegistrationInfoMessage(
                memoChannel,
                messageId,
                fullJson,
                'driver',
                interaction.user,
                config.ranks?.userRanks || {}
              ).catch(() => null);
            } else {
              const embed = buildDriverRegistrationEmbed(fullJson, interaction.user, config.ranks?.userRanks || {});
              const sentMessage = await memoChannel.send({ embeds: [embed] }).catch(() => null);
              if (sentMessage)
                await saveRegistrationMessageId(
                  interaction.guildId,
                  userId,
                  sentMessage.id,
                  'driver'
                ).catch(() => null);
            }
          } else {
            const userId = interaction.user.id;
            const fullJson = await loadDriverFull(interaction.guildId, userId);
            const registrationEmbed = buildDriverRegistrationEmbed(fullJson, interaction.user, config.ranks?.userRanks || {});

            const createResult = await createUserMemoChannel({
              guild: interaction.guild,
              user: interaction.user,
              categoryId: config.categories.userMemo,
              role: 'driver',
              registrationEmbed, // v2.6.4
            }).catch(() => null);

            if (createResult) {
              memoChannel = createResult.channel;
              if (createResult.registrationMessage) {
                await saveRegistrationMessageId(
                  interaction.guildId,
                  userId,
                  createResult.registrationMessage.id,
                  'driver'
                ).catch(() => null);
              }
            }
          }
        }

        // ユーザー確認パネルを更新
        const { updateUserCheckPanel, upsertRegistrationLedger } = require('./ユーザー確認パネル');
        await upsertRegistrationLedger(interaction.guild, 'driver', driverData).catch(() => null);
        await updateUserCheckPanel(interaction.guild, interaction.client).catch(() => null);

        // 履歴まとめ期間の選択を促す
        const { StringSelectMenuBuilder } = require('discord.js');
        const policyMenu = new StringSelectMenuBuilder()
          .setCustomId(`reg|driver|sub=policy&uid=${userId}`)
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
            content: '✅ 送迎者基本情報の登録が完了しました！\n続けて、以下のメニューから**履歴（メモ）のまとめ期間**を選択してください。',
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

        const driverData = await loadDriverFull(interaction.guildId, userId);
        if (driverData) {
          driverData.threadPolicy = {
            enabled: policy !== 'none',
            period: policy === 'none' ? null : policy,
          };
          await saveDriver(interaction.guildId, userId, driverData);
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

module.exports = { CID, buildDriverRegPanelMessage, updateDriverRegPanel, execute };
