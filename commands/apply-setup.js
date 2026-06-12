const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const GOLD = 0xF5A623;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('apply-setup')
    .setDescription('Post the Creator Program panel (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('open_application')
        .setLabel('Submit Application')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('👑')
    );

    // Message 1: Introduction
    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(GOLD)
          .setTitle('👑 Introducing the Godlyo Creator Program')
          .setDescription(
            'Earn **Robux and Godlys** by making videos about Godlyo.\n\n' +
            'Create content around trading, buying/selling, or anything else Godlyo-related — and get paid per 10,000 views.\n\n' +
            '**Payout Rates (per 10,000 views)**\n' +
            '> 🥉 **Tier 3** — 0 to 1,000 followers → **1,000 R$**\n' +
            '> 🥈 **Tier 2** — 1,000 to 10,000 followers → **1,200 R$**\n' +
            '> 🥇 **Tier 1** — 10,000+ followers → **1,500 R$**\n\n' +
            '*Tier is determined by your follower count at time of submission.*'
          )
          .setFooter({ text: 'Godlyo Creator Program • godlyo.com' }),
      ],
    });

    // Message 2: Rules
    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(GOLD)
          .setTitle('📋 Creator Program Rules')
          .setDescription(
            '**By applying you agree to all of the following:**\n\n' +
            '**1.** No botting or fake engagement of any kind\n' +
            '**2.** No hiding likes, comments, or other engagement metrics\n' +
            '**3.** Posts must remain public until payment has been received\n' +
            '**4.** Staff decisions are final — we reserve the right to refuse payment if we suspect any rule violations\n' +
            '**5.** Content **must** focus on Godlyo (trading, buying/selling, or anything site-related)\n' +
            '**6.** English or German content only\n' +
            '**7.** Your account must only post Roblox content and be mainly focused around MM2'
          )
          .setFooter({ text: 'Godlyo Creator Program • godlyo.com' }),
      ],
    });

    // Message 3: Apply button
    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(GOLD)
          .setTitle('Ready to apply?')
          .setDescription(
            'Click the button below to submit your application.\n' +
            'You\'ll be asked about your channel, content type, and average views.\n\n' +
            'Applications are reviewed within **48 hours**.'
          )
          .setFooter({ text: 'Godlyo Creator Program • godlyo.com' }),
      ],
      components: [row],
    });

    await interaction.reply({ content: '✅ Creator Program panel posted.', ephemeral: true });
  },
};
