const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getDb, get, run } = require('../utils/db');
const { GOLD } = require('../utils/embeds');

const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/mov',
];

function isProofFile(attachment) {
  if (!attachment) return false;
  const type = attachment.contentType || '';
  const name = attachment.name || '';
  return (
    ALLOWED_TYPES.some(t => type.startsWith(t.split('/')[0])) ||
    /\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i.test(name)
  );
}

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    if (message.author.bot) return;

    const proofFile = message.attachments.find(isProofFile);
    if (!proofFile) return;

    await getDb();

    const creator = get(
      'SELECT * FROM creators WHERE private_channel_id = ? AND status = ?',
      [message.channelId, 'accepted']
    );
    if (!creator) return;
    if (message.author.id !== creator.user_id) return;

    const submission = get(
      `SELECT * FROM submissions WHERE user_id = ? AND status = 'pending_proof' ORDER BY submitted_at DESC LIMIT 1`,
      [creator.user_id]
    );
    if (!submission) return;

    run(
      `UPDATE submissions SET proof_image_url = ?, status = 'pending_review' WHERE id = ?`,
      [proofFile.url, submission.id]
    );

    const tierLabels = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3' };
    const tierName = tierLabels[creator.tier] || 'Tier 3';

    // Confirm to creator
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(GOLD)
          .setTitle('✅ Proof Received')
          .setDescription(
            `Your recording has been received. Your submission is now **pending staff review**.\n` +
            `You'll be notified here within 24 hours.`
          )
          .addFields(
            { name: 'Submission ID', value: `#${submission.id}`, inline: true },
            { name: 'Platform', value: submission.platform, inline: true },
            { name: 'Views', value: Number(submission.views_at_submission).toLocaleString(), inline: true },
            { name: 'Robux if approved', value: `${Number(submission.robux_owed).toLocaleString()} R$`, inline: true },
          )
          .setFooter({ text: 'Godlyo Creator Program • godlyo.com' }),
      ],
    });

    // Forward to staff channel
    const staffChannelId = process.env.CREATOR_SUBMISSIONS_CHANNEL_ID;
    if (!staffChannelId) {
      console.error('CREATOR_SUBMISSIONS_CHANNEL_ID not set');
      return;
    }

    const staffChannel = await message.guild.channels.fetch(staffChannelId).catch(e => {
      console.error('Failed to fetch staff channel:', e.message);
      return null;
    });

    if (!staffChannel) {
      console.error('Staff submissions channel not found, ID:', staffChannelId);
      return;
    }

    const isVideo = (proofFile.contentType || '').startsWith('video') || /\.(mp4|mov|webm)$/i.test(proofFile.name || '');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_submission_${submission.id}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`reject_submission_${submission.id}`)
        .setLabel('Reject')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    const staffEmbed = new EmbedBuilder()
      .setColor(GOLD)
      .setTitle('New Video Submission')
      .addFields(
        { name: 'Creator', value: `<@${creator.user_id}> (${creator.username || creator.user_id})`, inline: true },
        { name: 'Platform', value: submission.platform, inline: true },
        { name: 'Tier', value: tierName, inline: true },
        { name: 'Video URL', value: submission.video_url },
        { name: 'Views', value: Number(submission.views_at_submission).toLocaleString(), inline: true },
        { name: 'Robux Owed', value: `${Number(submission.robux_owed).toLocaleString()} R$`, inline: true },
        { name: 'Proof', value: `[${isVideo ? 'View Recording' : 'View Screenshot'}](${proofFile.url})`, inline: true },
        { name: 'Submission ID', value: `#${submission.id}`, inline: true },
      )
      .setFooter({ text: 'Godlyo Creator Program • godlyo.com' });

    if (!isVideo) staffEmbed.setImage(proofFile.url);

    await staffChannel.send({ embeds: [staffEmbed], components: [row] }).catch(e => {
      console.error('Failed to send to staff channel:', e.message);
    });
  },
};
