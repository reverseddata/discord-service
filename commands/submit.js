const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { getDb, get, run, getTier, getWeeklyRobux } = require('../utils/db');
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

    // Determine rate: custom_rate overrides tier
    const tierKey = creator.tier || 'tier3';
    const { name: tierName, rate: tierRate } = getTier(tierKey);
    const rate = creator.custom_rate || tierRate;
    const robux = Math.floor((views / 10000) * rate);

    // Check weekly cap
    const weeklyUsed = getWeeklyRobux(interaction.user.id);
    const cap = creator.weekly_cap || 15000;
    const remaining = cap - weeklyUsed;

    if (remaining <= 0) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('Weekly Cap Reached')
          .setDescription(
            `You've reached your weekly cap of **${cap.toLocaleString()} R$**.\n` +
            `Your cap resets every Monday. If you think this should be increased, contact <@&${process.env.STAFF_ROLE_ID}>.`
          )],
        ephemeral: true,
      });
    }

    const effectiveRobux = Math.min(robux, remaining);
    const capped = effectiveRobux < robux;

    const now = new Date().toISOString();
    run(
      `INSERT INTO submissions
        (user_id, video_url, platform, submitted_at,
         views_at_submission, follower_count_at_submission, robux_owed, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_proof')`,
      [interaction.user.id, videoUrl, platform, now, views, 0, effectiveRobux]
    );

    const submission = get(
      'SELECT id FROM submissions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [interaction.user.id]
    );

    const rateLabel = creator.custom_rate ? `${rate} R$ (custom rate)` : `${rate} R$ (${tierName})`;

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
            { name: 'Rate', value: rateLabel, inline: true },
            { name: 'Robux if approved', value: `${effectiveRobux.toLocaleString()} R$${capped ? ' *(cap applied)*' : ''}`, inline: true },
            { name: 'Weekly cap remaining', value: `${remaining.toLocaleString()} R$ / ${cap.toLocaleString()} R$`, inline: true },
          )
          .setFooter({ text: `Submission ID: #${submission.id} • Upload your recording below` }),
      ],
    });
  },
};
