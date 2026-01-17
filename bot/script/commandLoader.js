const fs = require('node:fs');
const path = require('node:path');
const logger = require('../utils/logger');

const COMMANDS_DIR = process.env.COMMANDS_DIR || 'src/bot/command';

function walkJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkJsFiles(full));
    else if (e.isFile() && e.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function loadCommands(logPrefix = '') {
  const commandsRoot = path.join(process.cwd(), COMMANDS_DIR);
  if (!fs.existsSync(commandsRoot)) {
    logger.error(`${logPrefix} COMMANDS_DIR が存在しません: ${commandsRoot}`);
    return [];
  }

  const commandFiles = walkJsFiles(commandsRoot);
  const commands = [];
  for (const filePath of commandFiles) {
    delete require.cache[require.resolve(filePath)];
    const cmd = require(filePath);

    if (cmd?.data?.toJSON && typeof cmd.execute === 'function') {
      commands.push(cmd.data.toJSON());
    } else {
      logger.warn(`${logPrefix} [WARN] スキップ: ${filePath}（data.toJSON と execute が必要）`);
    }
  }
  return commands;
}

module.exports = { loadCommands };
