// handler/送迎パネル/アクション/出勤.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');

const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = async function (interaction, client, parsed) {
  const isModal = parsed?.params?.sub === 'modal';

  return autoInteractionTemplate(interaction, {
    ack: isModal ? ACK.REPLY : ACK.NONE,
    async run(interaction) {
      if (isModal) {
        // --- モーダル送信時 (Modal Submit) ---
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        // 入力値取得
        const stopPlace = interaction.fields.getTextInputValue('input|driver|place');
        const carInfo = interaction.fields.getTextInputValue('input|driver|car');
        const capacity = interaction.fields.getTextInputValue('input|driver|capacity');

        const data = {
          userId,
          stopPlace,
          carInfo,
          capacity,
          timestamp: new Date().toISOString(),
        };

        const waitPath = `${paths.waitingDriversDir(guildId)}/${userId}.json`;
        const isAlreadyWaiting = (await store.readJson(waitPath).catch(() => null)) !== null;

        await store.writeJson(waitPath, data);

        // 各パネル更新
        const { updateDriverPanel } = require('../メイン');
        const { updateUserPanel } = require('../../利用者パネル/メイン');
        const { updateRideListPanel } = require('../../送迎処理/一覧パネル更新');
        const { postGlobalLog } = require('../../../utils/ログ/グローバルログ');

        const { getQueue, getPosition } = require('../../../utils/配車/待機列マネージャ');
        const queue = await getQueue(guildId);
        const activeCount = queue.length;
        const myPosition = await getPosition(guildId, userId);

        if (!isAlreadyWaiting) {
          const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
          const embed = buildPanelEmbed({
            title: '🚗 送迎車 出勤通知',
            description: `送迎車が一台出勤しました。\n現在の待機台数：**${activeCount}** 台`,
            color: 0x2ecc71,
            client: interaction.client,
            fields: [
              { name: '📍 停留場所', value: stopPlace, inline: true },
              { name: '📋 車種/人数', value: `${carInfo} (${capacity})`, inline: true }
            ]
          });

          await postGlobalLog({
            guild: interaction.guild,
            content: '【出勤】送迎車がオンラインになりました。',
            embeds: [embed],
          }).catch(() => null);

          // 詳細ログ
          const { postDetailedAttendanceLog } = require('../../../utils/ログ/詳細ログ送信');
          await postDetailedAttendanceLog({
            guild: interaction.guild,
            user: interaction.user,
            data: data,
            type: 'on',
          }).catch(() => null);
        }

        await Promise.all([
          updateDriverPanel(interaction.guild, interaction.client),
          updateUserPanel(interaction.guild, interaction.client),
          updateRideListPanel(interaction.guild, interaction.client),
        ]).catch((err) => console.error('パネル更新失敗', err));

        return interaction.editReply({
          content: `✅ 待機中に追加しました。\n現在の待機順位は **第 ${myPosition} 位** です。`,
        });
      } else {
        // --- ボタン押下時 (Show Modal) ---
        const { loadDriver } = require('../../../utils/driversStore');
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // 1. 待機中チェック
        const waitPath = `${paths.waitingDriversDir(guildId)}/${userId}.json`;
        const isWaiting = (await store.readJson(waitPath).catch(() => null)) !== null;

        // 2. 配車中チェック
        const dispatchDir = paths.activeDispatchDir(guildId);
        const dispatchFiles = await store.listKeys(dispatchDir).catch(() => []);
        let isDispatching = false;
        for (const fileKey of dispatchFiles) {
          if (!fileKey.endsWith('.json')) continue;
          const data = await store.readJson(fileKey).catch(() => null);
          if (data?.driverId === userId) {
            isDispatching = true;
            break;
          }
        }

        if (isWaiting || isDispatching) {
          return interaction.reply({
            content: '⚠️ 既に待機中、または送迎中のため再出勤できません。\n送迎終了後、または退勤後に再度お試しください。',
            flags: 64,
          });
        }

        let currentData = await store.readJson(waitPath).catch(() => null);

        if (!currentData) {
          currentData = await loadDriver(guildId, userId);
        }

        const defaultPlace = currentData?.stopPlace || currentData?.stop || '';
        const defaultCar = currentData?.carInfo || currentData?.car || '';
        const defaultCapacity = currentData?.capacity || '';

        const modal = new ModalBuilder()
          .setCustomId('driver|on|sub=modal')
          .setTitle('今から行けます（送迎者）');

        const placeInput = new TextInputBuilder()
          .setCustomId('input|driver|place')
          .setLabel('停留場所')
          .setPlaceholder('例：駅南口ロータリー／コンビニ前')
          .setValue(String(defaultPlace))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50);

        const carInput = new TextInputBuilder()
          .setCustomId('input|driver|car')
          .setLabel('車種')
          .setPlaceholder('例：白プリウス 1234')
          .setValue(String(defaultCar))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50);

        const capacityInput = new TextInputBuilder()
          .setCustomId('input|driver|capacity')
          .setLabel('人数')
          .setPlaceholder('例：3人まで')
          .setValue(String(defaultCapacity))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(20);

        modal.addComponents(
          new ActionRowBuilder().addComponents(placeInput),
          new ActionRowBuilder().addComponents(carInput),
          new ActionRowBuilder().addComponents(capacityInput)
        );

        await interaction.showModal(modal);
      }
    },
  });
};
