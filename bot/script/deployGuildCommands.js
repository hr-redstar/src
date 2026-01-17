/**
 * ギルドコマンド登録スクリプト
 * -----------------------------------------
 * .env のトークン/クライアントID/ギルドIDを使って、ギルドコマンドを登録します。
 */

require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { createLogger } = require('../utils/logger');
const { requireEnv } = require('../utils/env');
const { loadCommands } = require('./commandLoader');

const logger = createLogger('DeployGuild');
requireEnv(['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID']);
const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

const commands = loadCommands('DeployGuild');

async function deployCommands() {
  if (commands.length === 0) {
    logger.warn('登録するギルドコマンドが見つかりませんでした。');
    return;
  }

  logger.info(`${commands.length}個のギルドコマンドをギルド(${GUILD_ID})に登録します...`);

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    const data = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    logger.success(`ギルド(${GUILD_ID})に ${data.length}個のコマンドを登録しました。`);
  } catch (error) {
    logger.error(`ギルド(${GUILD_ID})へのコマンド登録に失敗しました:`, error);
  }
}

module.exports = { deployCommands };