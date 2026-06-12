const { EmbedBuilder } = require('discord.js');

const GOLD = 0xF5A623;
const GREEN = 0x2ECC71;
const RED = 0xE74C3C;
const BLUE = 0x3498DB;

function applicationEmbed(user, data) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('New Creator Application')
    .addFields(
      { name: 'Applicant', value: `<@${user.id}> (${user.tag})`, inline: true },
      { name: 'Channel Link', value: data.channelLink },
      { name: 'Avg Views', value: data.avgViews, inline: true },
      { name: 'Content Type', value: data.contentType, inline: true },
      { name: 'Applied At', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
    )
    .setFooter({ text: 'Godlyo Creator Program • godlyo.com' });
}

function welcomeEmbed() {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('Welcome to the Godlyo Creator Program 👑')
    .setDescription(
      `Congratulations, you've been accepted into the Godlyo Creator Program!\n\n` +
      `This is your private channel for video submissions, payout requests, and any questions.\n` +
      `Submissions are reviewed within 24 hours.\n\n` +
      `**How it works:**\n` +
      `→ Use \`/submit\` to submit your video once it's live\n` +
      `→ Videos must be submitted within **72 hours** of posting — submissions after this window are ineligible\n` +
      `→ Views and follower count are recorded at submission time and used to calculate your payout\n` +
      `→ Payout is sent within 72 hours after review\n\n` +
      `For faster support, ping <@&${process.env.STAFF_ROLE_ID}> directly in this channel.`
    )
    .setFooter({ text: 'Godlyo Creator Program • godlyo.com' });
}

function submissionStaffEmbed(user, data, robux, tier) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('New Submission')
    .addFields(
      { name: 'Creator', value: `<@${user.id}>`, inline: true },
      { name: 'Platform', value: data.platform, inline: true },
      { name: 'URL', value: data.url },
      { name: 'Followers', value: `${data.followers.toLocaleString()} (${tier})`, inline: true },
      { name: 'Views', value: data.views.toLocaleString(), inline: true },
      { name: 'Robux Owed', value: `${robux.toLocaleString()} R$`, inline: true }
    )
    .setFooter({ text: 'Godlyo Creator Program' });
}

function submissionCreatorEmbed(data, robux, tier) {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle('Video Submitted ✅')
    .addFields(
      { name: 'Platform', value: data.platform, inline: true },
      { name: 'Followers at Submit', value: data.followers.toLocaleString(), inline: true },
      { name: 'Tier', value: tier, inline: true },
      { name: 'Views at Submission', value: data.views.toLocaleString(), inline: true },
      { name: 'Robux if Approved', value: `${robux.toLocaleString()} R$`, inline: true },
      { name: 'Status', value: 'Pending review (within 24h)', inline: true }
    )
    .setFooter({ text: 'Views and follower count are locked at submission time.' });
}

function approvedEmbed(url, views, robux) {
  return new EmbedBuilder()
    .setColor(GREEN)
    .setTitle('Submission Approved ✅')
    .addFields(
      { name: 'Video', value: url },
      { name: 'Views', value: views.toLocaleString(), inline: true },
      { name: 'Robux Owed', value: `${robux.toLocaleString()} R$`, inline: true },
      { name: 'Status', value: 'Awaiting payout (within 72h)', inline: true }
    );
}

function rejectedSubmissionEmbed() {
  return new EmbedBuilder()
    .setColor(RED)
    .setTitle('Submission Rejected')
    .setDescription(`Your submission was not approved. Please contact <@&${process.env.STAFF_ROLE_ID}> if you have questions.`);
}

function tooOldEmbed() {
  return new EmbedBuilder()
    .setColor(RED)
    .setTitle('Submission Rejected')
    .setDescription('This video was posted more than 72 hours ago and is ineligible for payout. Please submit within 72 hours of posting.');
}

function paidEmbed(robux) {
  return new EmbedBuilder()
    .setColor(GREEN)
    .setTitle('Payout Sent 💰')
    .setDescription(`Your Robux payout of **${robux.toLocaleString()} R$** has been sent. Check your Roblox account!`)
    .setFooter({ text: 'Thank you for creating content for Godlyo 👑' });
}

function errorEmbed(message) {
  return new EmbedBuilder().setColor(RED).setDescription(`❌ ${message}`);
}

module.exports = {
  GOLD, GREEN, RED, BLUE,
  applicationEmbed, welcomeEmbed,
  submissionStaffEmbed, submissionCreatorEmbed,
  approvedEmbed, rejectedSubmissionEmbed, tooOldEmbed,
  paidEmbed, errorEmbed,
};
