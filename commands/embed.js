const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const FOOTER = 'Godlyo.com - the only marketplace you need';

const COLORS = {
  gold: 0xF5A623,
  white: 0xFFFFFF,
  black: 0x000000,
  green: 0x2ECC71,
  red: 0xE74C3C,
  blue: 0x3498DB,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Post a custom embed message (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(opt =>
      opt.setName('title').setDescription('Embed title').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('description').setDescription('Embed description (use \\n for new lines)').setRequired(true)
    )
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to post in (default: current channel)').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('Embed color (default: gold)')
        .setRequired(false)
        .addChoices(
          { name: 'Gold (default)', value: 'gold' },
          { name: 'White', value: 'white' },
          { name: 'Black', value: 'black' },
          { name: 'Green', value: 'green' },
          { name: 'Red', value: 'red' },
          { name: 'Blue', value: 'blue' },
        )
    )
    .addStringOption(opt =>
      opt.setName('image').setDescription('Image URL to attach to the embed').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('ping').setDescription('Role or user to ping with the message').setRequired(false)
    ),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description').replace(/\\n/g, '\n');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const colorKey = interaction.options.getString('color') || 'gold';
    const image = interaction.options.getString('image');
    const ping = interaction.options.getString('ping');

    const embed = new EmbedBuilder()
      .setColor(COLORS[colorKey])
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: FOOTER });

    if (image) embed.setImage(image);

    const payload = { embeds: [embed] };
    if (ping) payload.content = ping;

    await channel.send(payload);
    await interaction.reply({ content: `✅ Embed posted in <#${channel.id}>`, ephemeral: true });
  },
};
