const { installPanel } = require('../共通/設置テンプレ');
const { updatePanelSetupPanel } = require('../メイン');
const { buildRideListPanelMessage } = require('../../送迎パネル/埋め込み作成');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { CUSTOM_ID, MessageFlags } = require('../共通/_panelSetupCommon');
const { updateRideListPanel } = require('../../送迎処理/一覧パネル更新');

module.exports = {
  customId: CUSTOM_ID.SELECT_RIDE_LIST_PANEL_CHANNEL,
  type: 'channelSelect',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.UPDATE,
      adminOnly: true,
      async run(interaction) {
        const channelId = interaction.values[0];
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!channel) {
          return interaction.followUp({
            content: '❌ 指定されたチャンネルが見つかりませんでした。',
            flags: MessageFlags.Ephemeral,
          });
        }

        const guild = interaction.guild;
        const ok = await installPanel({
          interaction,
          panelKey: 'rideList',
          panelName: '送迎一覧パネル',
          channel,
          buildMessage: () => buildRideListPanelMessage(guild, interaction.client),
        });

        if (ok) {
          await updatePanelSetupPanel(guild);
          await updateRideListPanel(guild);
          await interaction.followUp({
            content: `✅ <#${channel.id}> に送迎一覧パネルを設置しました。\n（このパネルは送迎状況に合わせて自動で更新されます）`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.followUp({
            content: `❌ 送迎一覧パネルの送信に失敗しました。`,
            flags: MessageFlags.Ephemeral,
          });
        }
      },
    });
  },
};
