const { buildDriverRegPanelMessage } = require('../登録処理/送迎者登録');

module.exports.sendDriverRegisterPanel = async (channel) => {
  const guild = channel.guild;
  const messagePayload = buildDriverRegPanelMessage(guild, guild.client);

  await channel.send(messagePayload);
};
