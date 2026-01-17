const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PANEL_SETUP_IDS } = require('../共通/_panelSetupCommon');

// 各パネルのメッセージ生成ロジック
// 元のハンドラファイルからロジックをコピー、またはインポートして使用する設計
// ここでは、依存関係を減らすために直接メッセージを構築する形をとる（UIの統一性維持のため）

module.exports.sendSpecificPanel = async function (guild, channel, panelType) {
  let embeds = [];
  let components = [];

  switch (panelType) {
    case 'driver_panel':
      // 送迎者パネル (メイン/送迎パネル/メイン.js 参照)
      embeds.push(
        new EmbedBuilder()
          .setTitle('送迎者操作パネル')
          .setDescription('出勤・退勤の操作を行います。')
          .setColor(0x3498db)
      );
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('driver:work_start')
            .setLabel('出勤')
            .setStyle(ButtonStyle.Success)
            .setEmoji('上班'),
          new ButtonBuilder()
            .setCustomId('driver:work_end')
            .setLabel('退勤')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('下班'),
          new ButtonBuilder()
            .setCustomId('driver:break_start')
            .setLabel('休憩')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('☕'),
          new ButtonBuilder()
            .setCustomId('driver:break_end')
            .setLabel('再開')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('▶️')
        )
      );
      break;

    case 'user_panel':
      // 利用者パネル
      embeds.push(
        new EmbedBuilder()
          .setTitle('送迎依頼パネル')
          .setDescription('送迎の依頼はこちらから行えます。')
          .setColor(0x2ecc71)
      );
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ride:request')
            .setLabel('送迎を依頼する')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🚕')
        )
      );
      break;

    case 'ride_list_panel':
      // 送迎一覧パネル
      // ※このパネルは動的に更新されるため、初期状態は空またはプレースホルダー
      // 実装上、updateRideListPanel を呼ぶのが正しいが、初期設置時は枠だけで良い
      embeds.push(
        new EmbedBuilder()
          .setTitle('現在稼働中の送迎一覧')
          .setDescription('現在稼働中の送迎はありません。')
          .setColor(0x95a5a6)
      );
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin:ride:force_end_menu')
            .setLabel('送迎強制終了')
            .setStyle(ButtonStyle.Danger)
        )
      );
      break;

    case 'driver_reg_panel':
      // 送迎者登録パネル
      embeds.push(
        new EmbedBuilder()
          .setTitle('送迎者登録')
          .setDescription('送迎者としての登録・更新を行います。')
          .setColor(0xe67e22)
      );
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('register:driver')
            .setLabel('送迎者登録・更新')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('ps:check')
            .setLabel('登録状態確認')
            .setStyle(ButtonStyle.Secondary)
        )
      );
      break;

    case 'user_reg_panel':
      // 利用者登録パネル
      embeds.push(
        new EmbedBuilder()
          .setTitle('利用者登録')
          .setDescription('利用者としての登録・更新を行います。')
          .setColor(0xe67e22)
      );
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('register:user')
            .setLabel('利用者登録・更新')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('ps:check')
            .setLabel('登録状態確認')
            .setStyle(ButtonStyle.Secondary)
        )
      );
      break;

    case 'rating_rank_panel':
      // 口コミランクパネル
      embeds.push(
        new EmbedBuilder()
          .setTitle('🏆 口コミランキング')
          .setDescription('送迎者の評価ランキングです。\n(定期的に更新されます)')
          .setColor(0xf1c40f)
      );
      // コンポーネントなし（または更新ボタン？）
      break;

    case 'admin_panel':
      // 管理者パネル
      embeds.push(
        new EmbedBuilder()
          .setTitle('管理者パネル')
          .setDescription('システム設定やログ確認を行います。')
          .addFields({ name: '登録地点一覧', value: '(未設定)' }) // プレースホルダー
          .setColor(0x992d22)
      );
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('admin:settings')
            .setLabel('設定変更')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('admin:history')
            .setLabel('履歴確認')
            .setStyle(ButtonStyle.Secondary)
        )
      );
      break;
  }

  if (embeds.length > 0) {
    await channel.send({ embeds, components });
  }
};
