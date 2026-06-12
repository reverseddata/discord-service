const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb, get, all } = require('../utils/db');
const { errorEmbed, GOLD } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('payout-history')
    .setDescription('View your submission and payout history'),

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

    const submissions = all(
      'SELECT * FROM submissions WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 20',
      [interaction.user.id]
    );

    if (submissions.length === 0) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(GOLD)
          .setTitle('Your Payout History')
          .setDescription('No submissions yet. Use `/submit` to submit your first video!')],
        ephemeral: true,
      });
    }

    const totalEarned = submissions
      .filter(s => s.status === 'paid')
      .reduce((sum, s) => sum + s.robux_owed, 0);

    const totalPending = submissions
      .filter(s => s.status === 'verified' || s.status === 'pending_review')
      .reduce((sum, s) => sum + s.robux_owed, 0);

    const statusEmoji = {
      pending_proof: '📸',
      pending_review: '🕐',
      verified: '✅',
      paid: '💰',
      rejected: '❌',
    };

    const fields = submissions.map(s => {
      const date = new Date(s.submitted_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      const emoji = statusEmoji[s.status] || '?';
      return {
        name: `${emoji} ${s.platform} — ${date}`,
        value: `${Number(s.views_at_submission).toLocaleString()} views | **${Number(s.robux_owed).toLocaleString()} R$** | ${s.status.replace('_', ' ')}`,
      };
    });

    const embed = new EmbedBuilder()
      .setColor(GOLD)
      .setTitle('Your Payout History')
      .addFields(fields)
      .setFooter({
        text: `Total earned: ${totalEarned.toLocaleString()} R$ | Total pending: ${totalPending.toLocaleString()} R$`,
      });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
