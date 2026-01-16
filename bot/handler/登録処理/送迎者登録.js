// src/bot/handler/登録処理/送迎者登録.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require("discord.js");

const logger = require("../../utils/ログ/ロガー");
const { readJson, writeJson } = require("../../utils/ストレージ/ストア共通");
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage_ = require('../../utils/embed/panelMessageTemplate');
const interactionTemplate = require("../共通/interactionTemplate");
const { ACK } = interactionTemplate;

// ===== Custom IDs =====
const CID = {
  BTN_REGISTER: "driver:btn:register",
  MODAL_REGISTER: "driver:modal:register",
  INP_AREA: "driver:input:area",
  INP_STOP: "driver:input:stop",
  INP_NICKNAME: "driver:input:nickname",
  INP_CAR: "driver:input:car",
  INP_CAPACITY: "driver:input:capacity",
};

// ===== Paths =====
const paths = require("../../utils/ストレージ/ストレージパス");

const nowIso = () => new Date().toISOString();

/**
 * 送迎者登録パネルのメッセージペイロードを生成
 */
function buildDriverRegPanelMessage(guild, client) {
  const embed = buildPanelEmbed({
    title: "送迎者登録パネル",
    description: `
**区域**
普段活動しているエリアを入力してください。

**停留場所**
待機する際の具体的な場所（駅、コンビニ等）を入力してください。

**その他の情報**
ニックネーム、車種、最大乗車人数などを入力します。
    `,
    client
  });

  if (guild?.iconURL()) embed.setThumbnail(guild.iconURL());

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CID.BTN_REGISTER)
      .setLabel("送迎者登録")
      .setStyle(ButtonStyle.Success)
  );

  return buildPanelMessage_({ embed, components: [row] });
}

/**
 * ハンドラー実行
 */
async function execute(interaction) {
  if (!interaction.guildId) return;

  // ボタン → モーダル
  if (interaction.isButton() && interaction.customId === CID.BTN_REGISTER) {
    const modal = new ModalBuilder()
      .setCustomId(CID.MODAL_REGISTER)
      .setTitle("送迎者登録");

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_AREA)
          .setLabel("区域")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_STOP)
          .setLabel("停留場所")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_NICKNAME)
          .setLabel("ニックネーム（任意）")
          .setStyle(TextInputStyle.Short)
          .setRequired(false) // 任意
          .setMaxLength(30)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_CAR)
          .setLabel("車種（任意）")
          .setStyle(TextInputStyle.Short)
          .setRequired(false) // 任意
          .setMaxLength(50)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(CID.INP_CAPACITY)
          .setLabel("乗車人数（数字）")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(3)
      )
    );

    return interaction.showModal(modal);
  }

  // モーダル → 保存
  if (interaction.isModalSubmit() && interaction.customId === CID.MODAL_REGISTER) {
    return interactionTemplate(interaction, {
      ack: ACK.REPLY,
      async run(interaction) {
        // 設定読み込み (ロール・ログ用)
        const { loadConfig } = require("../../utils/設定/設定マネージャ");
        const config = await loadConfig(interaction.guildId);

        const area = interaction.fields.getTextInputValue(CID.INP_AREA)?.trim();
        const stop = interaction.fields.getTextInputValue(CID.INP_STOP)?.trim();
        const nickname = interaction.fields.getTextInputValue(CID.INP_NICKNAME)?.trim() || null;
        const car = interaction.fields.getTextInputValue(CID.INP_CAR)?.trim() || null;
        const capRaw = interaction.fields.getTextInputValue(CID.INP_CAPACITY)?.trim();

        const capacity = Number.parseInt(capRaw, 10);
        if (!Number.isFinite(capacity) || capacity <= 0 || capacity > 99) {
          return interaction.editReply({ content: "⚠️ 乗車人数は 1〜99 の数字で入力してください。" });
        }

        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        // データ保存履歴付き (インデックス更新含む)
        const { saveDriver } = require("../../utils/driversStore");
        const driverData = {
          userId,
          area,
          stop,
          nickname,
          car,
          capacity,
          registeredAt: nowIso(),
          active: false, // 初期状態
        };

        await saveDriver(guildId, userId, driverData);

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
        const logChId = config.logs?.operatorChannel;
        if (logChId) {
          const ch = await interaction.guild.channels.fetch(logChId).catch(() => null);
          if (ch) {
            const logEmbed = new EmbedBuilder()
              .setTitle("🚗 送迎者登録")
              .setColor(0x2ecc71)
              .addFields(
                { name: "ユーザー", value: `<@${userId}>`, inline: true },
                { name: "区域", value: area, inline: true },
                { name: "停留場所", value: stop, inline: true },
                { name: "車種", value: car || "未設定", inline: true },
                { name: "乗車人数", value: `${capacity}人`, inline: true },
                { name: "ニックネーム", value: nickname || "未設定", inline: true }
              )
              .setTimestamp();
            await ch.send({ embeds: [logEmbed] }).catch(err => logger.debug("ログ送信失敗", err.message));
          }
        }

        // パネル更新 (ユーザー確認パネルなどがあれば)
        // 必要に応じて処理を追加

        await interaction.editReply({ content: "✅ 送迎者登録が完了しました！" });
      }
    });
  }
}

module.exports = { CID, buildDriverRegPanelMessage, execute };
