require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const commands = [];
const commandsPath = path.join(__dirname, "../command");

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if (command && "data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    } else {
      logger.warn(`[WARNING] ${file} には必要な "data" または "execute" プロパティがありません。`);
    }
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    logger.info(`${commands.length} 個のグローバルコマンドの登録を開始します...`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    logger.info(`✅ ${data.length} 個のグローバルコマンドを正常に登録しました。`);
  } catch (error) {
    logger.error(error);
  }
})();