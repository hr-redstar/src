const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');

/**
 * 送迎者へ相乗り希望のDMを送信する
 */
async function sendDriverCarpoolRequestDM({
  driver,
  requester,
  pickup,
  passengerCount,
  route,
  rideId,
}) {
  const embed = buildPanelEmbed({
    title: '相乗り希望が届きました',
    description: [
      `👤 希望者：${requester}`,
      `📍 相乗り希望位置：${pickup}`,
      `👥 乗車人数：${passengerCount}人`,
      '',
      `🛣 現在のルート`,
      route,
      '',
      '上記の内容で相乗りを承認しますか？',
    ].join('\n'),
    type: 'info',
    client: client
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`carpool|approve|rid=${rideId}&uid=${requester.id}&cnt=${passengerCount}`)
      .setLabel('承認')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`carpool|reject|rid=${rideId}&uid=${requester.id}&cnt=${passengerCount}`)
      .setLabel('却下')
      .setStyle(ButtonStyle.Danger)
  );

  try {
    const dm = await driver.createDM();
    await dm.send({ embeds: [embed], components: [row] });
    return true;
  } catch (err) {
    console.error(`[CarpoolDM] Failed to send DM to driver ${driver.id}:`, err);
    return false;
  }
}

module.exports = { sendDriverCarpoolRequestDM };
