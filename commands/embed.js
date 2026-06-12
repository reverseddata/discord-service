const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const FOOTER = 'Godlyo.com - the only marketplace you need';
const WHITE = 0xFFFFFF;

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
      opt.setName('image').setDescription('Image URL to attach to the embed').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('ping').setDescription('Role or user to ping with the message').setRequired(false)
    ),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description').replace(/\\n/g, '\n');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const image = interaction.options.getString('image');
    const ping = interaction.options.getString('ping');

    const embed = new EmbedBuilder()
      .setColor(WHITE)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: FOOTER })
      .setTimestamp();

    if (image) embed.setImage(image);

    const payload = { embeds: [embed] };
    if (ping) payload.content = ping;

    await channel.send(payload);
    await interaction.reply({ content: `✅ Embed posted in <#${channel.id}>`, ephemeral: true });
  },
};
