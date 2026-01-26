﻿// handler/送迎パネル/アクション/現在地更新.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');

module.exports = async function (interaction, client, parsed, onUpdate) {
  const isModal = parsed?.params?.sub === 'modal';

  return autoInteractionTemplate(interaction, {
    ack: isModal ? ACK.REPLY : ACK.NONE,
    panelKey: 'driverPanel',
    async run(interaction) {
      if (isModal) {
        // --- モーダル送信時 (Modal Submit) ---
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        const location = interaction.fields.getTextInputValue('input|driver|location');

        const profilePath = paths.driverProfileJson(guildId, userId);
        const profileData = await store.readJson(profilePath).catch(() => null);
        if (profileData) {
          profileData.stopPlace = location;
          await store.writeJson(profilePath, profileData);
        }

        // 待機中データも更新（もしあれば） (Atomic v2.9.3)
        const { updateQueueItem } = require('../../../utils/配車/待機列マネージャ');
        await updateQueueItem(guildId, userId, { stopPlace: location });

        if (onUpdate) {
          await onUpdate();
        }

        const { getPosition } = require('../../../utils/配車/待機列マネージャ');
        const myPosition = await getPosition(guildId, userId);
        const posText = myPosition ? `\n現在の待機順位は **第 ${myPosition} 位** です。` : '';

        return interaction.editReply({
          content: `✅ 現在地を「${location}」に更新しました。${posText}`,
        });
      } else {
        // --- ボタン押下時 (Show Modal) ---
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        // 0. 送迎者登録チェック (v2.9.2)
        const { loadDriverFull } = require('../../../utils/driversStore');
        const fullDriver = await loadDriverFull(guildId, userId).catch(() => null);

        if (!fullDriver || (!fullDriver.current && !fullDriver.car)) {
          return interaction.reply({
            content: '⚠️ 送迎者登録が見つかりません。先に「送迎者登録」を行い、その後「出勤」してください。',
            flags: 64,
          });
        }

        // 待機中チェック: 待機中の送迎者のみ許可
        const waitPath = `${paths.waitingDriversDir(guildId)}/${userId}.json`;
        const isWaiting = (await store.readJson(waitPath).catch(() => null)) !== null;

        if (!isWaiting) {
          return interaction.reply({
            content: '⚠️ 現在地更新は待機中の送迎者のみ実行できます。\n先に「出勤」ボタンから出勤してください。',
            flags: 64
          });
        }

        const modal = new ModalBuilder()
          .setCustomId('driver|location|sub=modal')
          .setTitle('現在地の更新');

        const locInput = new TextInputBuilder()
          .setCustomId('input|driver|location')
          .setLabel('現在地')
          .setPlaceholder('例：駅前、〇〇ビル前 など')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(50);

        modal.addComponents(new ActionRowBuilder().addComponents(locInput));

        await interaction.showModal(modal);
      }
    },
  });
};
