﻿// handler/送迎パネル/アクション/出勤.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');

const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = async function (interaction, client, parsed) {
  const isModal = parsed?.params?.sub === 'modal';

  return autoInteractionTemplate(interaction, {
    ack: isModal ? ACK.REPLY : ACK.NONE,
    panelKey: 'driverPanel',
    async run(interaction) {
      if (isModal) {
        // --- モーダル送信時 (Modal Submit) ---
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        // 入力値取得
        const carInfo = interaction.fields.getTextInputValue('input|driver|car');
        const capacity = interaction.fields.getTextInputValue('input|driver|capacity');
        const stopPlace = interaction.fields.getTextInputValue('input|driver|location');

        const data = {
          userId,
          carInfo,
          capacity,
          stopPlace,
          timestamp: new Date().toISOString(),
        };

        const waitPath = `${paths.waitingDriversDir(guildId)}/${userId}.json`;
        const isAlreadyWaiting = (await store.readJson(waitPath).catch(() => null)) !== null;

        await store.writeJson(waitPath, data);

        const { addToQueue, getPosition, popNextDriver } = require('../../../utils/配車/待機列マネージャ');

        await addToQueue(guildId, data);

        // --- ハンドオーバー・クリーンアップ (v2.9.4) ---
        const { runHandoverCheck } = require('../../../utils/配車/handoverProtocol');
        await runHandoverCheck(interaction.guild).catch(() => null);

        // --- 空き待ち自動マッチングチェック (v2.9.4) ---
        const { popNextRideRequest } = require('../../../utils/配車/配車待ちマネージャ');
        const pendingRequest = await popNextRideRequest(guildId);

        if (pendingRequest) {
          // このドライバーが今追加されたばかりの先頭ならマッチングを試みる
          // ただし、popNextDriverで自分自身が取れるとは限らない（他に待機者がいれば古い順）
          // ここでは「誰かが待機中になったから、誰か一人配車する」というトリガーとして機能
          const availableDriver = await popNextDriver(guildId);
          if (availableDriver) {
            const createDispatchVC = require('../../送迎処理/createDispatchVC');
            const { loadConfig } = require('../../../utils/設定/設定マネージャ');
            const config = await loadConfig(guildId);
            const requester = await client.users.fetch(pendingRequest.userId).catch(() => null);

            if (requester) {
              const rideId = `${Date.now()}_${requester.id}_${guildId}`;
              const dispatchData = {
                rideId,
                userId: requester.id,
                driverId: availableDriver.userId,
                driverPlace: availableDriver.stopPlace || '不明',
                direction: pendingRequest.direction,
                count: parseInt(pendingRequest.persons),
                destination: pendingRequest.destination || pendingRequest.direction,
                note: pendingRequest.note,
                status: 'MATCHED',
                startedAt: new Date().toISOString(),
                guest: pendingRequest.type === 'guest',
              };

              await createDispatchVC({
                guild: interaction.guild,
                requester,
                driverId: availableDriver.userId,
                driverPlace: dispatchData.driverPlace,
                dispatchData,
                config
              }).catch(() => null);
            }
          }
        }

        // 各パネル更新
        const { postOperatorLog } = require('../../../utils/ログ/運営者ログ');
        const queue = await require('../../../utils/配車/待機列マネージャ').getQueue(guildId);
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
              { name: '📋 車種/カラー/ナンバー (人数)', value: `${carInfo} (${capacity})`, inline: true },
              { name: '📍 現在地', value: stopPlace, inline: true }
            ]
          });

          await postOperatorLog({
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

        return interaction.editReply({
          content: `✅ 待機中に追加しました。\n現在の待機順位は **第 ${myPosition} 位** です。`,
        });
      } else {
        // --- ボタン押下時 (Show Modal) ---
        const { loadDriver } = require('../../../utils/driversStore');
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        // 0. 送迎者登録チェック (v2.9.2)
        const { loadDriverFull } = require('../../../utils/driversStore');
        const fullDriver = await loadDriverFull(guildId, userId).catch(() => null);

        if (!fullDriver || (!fullDriver.current && !fullDriver.car)) {
          const { loadConfig } = require('../../../utils/設定/設定マネージャ');
          const config = await loadConfig(guildId);
          const regChannelId = config.panels?.driverRegister?.channelId;
          const regLink = regChannelId ? `\n👉 <#${regChannelId}> から送迎者登録を行ってください。` : '\n管理者へお問い合わせください。';

          return interaction.reply({
            content: `⚠️ 送迎者登録が必要です。${regLink}`,
            flags: 64,
          });
        }

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
          if (data?.driverId === userId && data?.status !== 'COMPLETED') {
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

        // Handle double-nested current structure (current.current)
        const actualData = currentData?.current || currentData;

        const defaultCar = actualData?.car || actualData?.carInfo || '';
        const defaultCapacity = actualData?.capacity || '';
        const defaultLocation = actualData?.stopPlace || '';

        const modal = new ModalBuilder()
          .setCustomId('driver|on|sub=modal')
          .setTitle('出勤（送迎者）');


        const carInput = new TextInputBuilder()
          .setCustomId('input|driver|car')
          .setLabel('車種/カラー/ナンバー')
          .setPlaceholder('例：プリウス 白 1234')
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

        const locationInput = new TextInputBuilder()
          .setCustomId('input|driver|location')
          .setLabel('現在地')
          .setPlaceholder('例：ローソン前、〇〇ビル付近')
          .setValue(String(defaultLocation))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50);

        modal.addComponents(
          new ActionRowBuilder().addComponents(carInput),
          new ActionRowBuilder().addComponents(capacityInput),
          new ActionRowBuilder().addComponents(locationInput)
        );

        await interaction.showModal(modal);
      }
    },
  });
};
