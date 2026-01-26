// handler/共通/共通UI.js
const buildPanelEmbed = require('../../utils/embed/embedTemplate');

/**
 * 統一された形式の Embed を生成する (v2.0.0 Professional Edition)
 * @param {object} options
 * @param {string} options.title パネルの名前（例: "送迎者"）
 * @param {string} options.description 説明文
 * @param {string} [options.type] プリセット型 (success|warning|error|info)
 * @param {Client} client クライアントオブジェクト
 * @returns {EmbedBuilder}
 */
function buildCommonEmbed({ title, description, type = 'info' }, client) {
  return buildPanelEmbed({
    title: `${title}パネル`,
    description,
    type,
    client
  });
}

module.exports = {
  buildCommonEmbed,
};
