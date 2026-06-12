const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { getDb, get, run, getTier, calcRobux } = require('../utils/db');
const { errorEmbed, GOLD } = require('../utils/embeds');

function parsePlatform(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('instagram.com')) return 'Instagram';
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Submit a video for the Godlyo Creator Program')
    .addStringOption(opt =>
      opt.setName('video_url').setDescription('Full URL of your video').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('views').setDescription('Current view count on the video').setRequired(true)
    ),

  async execute(interaction) {
    await getDb();

    const creator = get('SELECT * FROM creators WHERE user_id = ? AND status = ?', [
      interaction.user.id, 'accepted',
    ]);

    if (!creator) {
      return interaction.reply({
        embeds: [errorEmbed('You must be an accepted creator to use this command.')],
        ephemeral: true,
      });
    }

    if (interaction.channelId !== creator.private_channel_id) {
      return interaction.reply({
        embeds: [errorEmbed('Please use this command in your private creator channel.')],
        ephemeral: true,
      });
    }

    const videoUrl = interaction.options.getString('video_url');
    const views = interaction.options.getInteger('views');

    const platform = parsePlatform(videoUrl);
    if (!platform) {
      return interaction.reply({
        embeds: [errorEmbed('Unsupported platform. Please use a TikTok, YouTube, or Instagram URL.')],
        ephemeral: true,
      });
    }

    // Use tier from creator's current tier in DB (set by staff or /changetier)
    const tierName = creator.tier
      ? creator.tier.charAt(0).toUpperCase() + creator.tier.slice(1)
      : 'Tier3';

    const tierRates = { tier1: 1500, tier2: 1200, tier3: 1000 };
    const rate = tierRates[creator.tier] || 1000;
    const robux = Math.floor((views / 10000) * rate);

    const now = new Date().toISOString();
    run(
      `INSERT INTO submissions
        (user_id, video_url, platform, submitted_at,
         views_at_submission, follower_count_at_submission, robux_owed, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_proof')`,
      [interaction.user.id, videoUrl, platform, now, views, 0, robux]
    );

    const submission = get(
      'SELECT id FROM submissions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [interaction.user.id]
    );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(GOLD)
          .setTitle('🎥 Recording Required')
          .setDescription(
            `Almost done! Please upload a **screen recording** of your full video analytics.\n\n` +
            `**Your recording must clearly show:**\n` +
            `→ The video URL or title\n` +
            `→ View count matching your submitted number (**${views.toLocaleString()} views**)\n` +
            `→ Full analytics page (likes, comments, watch time visible)\n\n` +
            `Upload the recording as a file in this channel. Your submission will be forwarded to staff once received.`
          )
          .addFields(
            { name: 'Platform', value: platform, inline: true },
            { name: 'Views submitted', value: views.toLocaleString(), inline: true },
            { name: 'Tier', value: tierName, inline: true },
            { name: 'Robux if approved', value: `${robux.toLocaleString()} R$`, inline: true },
          )
          .setFooter({ text: `Submission ID: #${submission.id} • Upload your recording below` }),
      ],
    });
  },
};
