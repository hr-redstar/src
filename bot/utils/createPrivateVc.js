const {
    ChannelType,
    PermissionFlagsBits,
} = require("discord.js");

module.exports.createPrivateVc = async ({
    guild,
    driver,
    user,
    categoryId,
}) => {
    if (!categoryId) return null;

    const vc = await guild.channels.create({
        name: `送迎-${driver.username}-${user.username}`,
        type: ChannelType.GuildVoice,
        parent: categoryId,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionFlagsBits.ViewChannel],
            },
            {
                id: driver.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.Connect,
                    PermissionFlagsBits.Speak,
                ],
            },
            {
                id: user.id,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.Connect,
                    PermissionFlagsBits.Speak,
                ],
            },
        ],
    });

    return vc;
};
