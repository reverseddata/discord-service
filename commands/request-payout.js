const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { getDb, get, all } = require('../utils/db');
const { errorEmbed, GOLD } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('request-payout')
    .setDescription('Request a Robux payout for your approved submissions'),

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

    // Get all verified (approved but unpaid) submissions
    const eligible = all(
      `SELECT * FROM submissions WHERE user_id = ? AND status = 'verified' ORDER BY submitted_at ASC`,
      [interaction.user.id]
    );

    if (eligible.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('You have no approved submissions eligible for payout yet.')],
        ephemeral: true,
      });
    }

    const totalEligible = Math.floor(eligible.reduce((sum, s) => sum + s.robux_owed, 0));

    if (totalEligible < 1000) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('Minimum Not Reached')
          .setDescription(
            `Your current eligible balance is **${totalEligible.toLocaleString()} R$**.\n` +
            `The minimum payout amount is **1,000 R$**.\n\n` +
            `Keep submitting videos to reach the minimum!`
          )],
        ephemeral: true,
      });
    }

    const subList = eligible.map(s =>
      `#${s.id} — ${s.platform} — ${Number(s.views_at_submission).toLocaleString()} views — **${Math.floor(s.robux_owed).toLocaleString()} R$**`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setColor(GOLD)
      .setTitle('💰 Request Payout')
      .setDescription(
        `You have **${eligible.length}** approved submission${eligible.length > 1 ? 's' : ''} eligible for payout.\n\n` +
        `**Eligible Submissions:**\n${subList}\n\n` +
        `**Total eligible: ${totalEligible.toLocaleString()} R$**\n\n` +
        `Click the button below to submit your payout request.`
      )
      .setFooter({ text: 'Minimum payout: 1,000 R$ • Godlyo Creator Program' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`open_payout_modal_${interaction.user.id}`)
        .setLabel('Request Payout')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💰')
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
