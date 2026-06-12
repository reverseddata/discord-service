module.exports = {
  name: 'guildMemberAdd',

  async execute(member, client) {
    const message = 
      `Welcome to the official Godlyo Discord, **${member.user.username}**! 👑\n\n` +
      `Please read the rules and verify your Roblox account to get started.\n\n` +
      `Check out our FAQ to get onboarded with all the latest features — and don't forget to visit **godlyo.com**, the only MM2 marketplace you need.`;

    await member.send(message).catch(() => {});
  },
};
