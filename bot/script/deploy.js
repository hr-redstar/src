/**
 * deploy.js
 * 例:
 *  node scripts/deploy.js guild
 *  node scripts/deploy.js global
 *  node scripts/deploy.js all
 */

const logger = require('../utils/logger').createLogger('Deploy');

const mode = (process.argv[2] || '').toLowerCase();

async function main() {
  if (!mode || !['guild', 'global', 'all'].includes(mode)) {
    logger.error('mode を指定してください: guild | global | all');
    process.exit(1);
  }

  if (mode === 'guild' || mode === 'all') {
    const { deployCommands: deployGuild } = require('./deployGuildCommands');
    await deployGuild();
  }

  if (mode === 'global' || mode === 'all') {
    const { deployCommands: deployGlobal } = require('./deployGlobalCommands');
    await deployGlobal();
  }
}

main().catch((e) => {
  logger.error('deploy 実行中に例外が発生しました:', e);
  process.exit(1);
});
