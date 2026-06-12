const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { getDb, get, all, run, getTier } = require('../utils/db');
const { errorEmbed, paidEmbed, GOLD } = require('../utils/embeds');

// /setfollowers
const setfollowers = {
  data: new SlashCommandBuilder()
    .setName('setfollowers')
    .setDescription('Manually set a creator\'s follower count (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt =>
      opt.setName('user').setDescription('The creator').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('count').setDescription('Follower count').setRequired(true)
    ),

  async execute(interaction) {
    await getDb();
    const target = interaction.options.getUser('user');
    const count = interaction.options.getInteger('count');
    const { name: tier } = getTier(count);

    run('UPDATE creators SET follower_count = ?, tier = ? WHERE user_id = ?', [
      count, tier.toLowerCase(), target.id,
    ]);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(GOLD)
        .setDescription(`✅ Set follower count for <@${target.id}> to **${count.toLocaleString()}** — Tier: **${tier}**`)],
      ephemeral: true,
    });
  },
};

// /creatorlist
const creatorlist = {
  data: new SlashCommandBuilder()
    .setName('creatorlist')
    .setDescription('List all active creators (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    await getDb();
    const creators = all('SELECT * FROM creators WHERE status = ?', ['accepted']);

    if (creators.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('No active creators yet.')],
        ephemeral: true,
      });
    }

    const fields = await Promise.all(creators.map(async c => {
      const subs = all('SELECT * FROM submissions WHERE user_id = ?', [c.user_id]);
      const totalPaid = subs
        .filter(s => s.status === 'paid')
        .reduce((sum, s) => sum + s.robux_owed, 0);
      const { name: tier } = getTier(c.follower_count || 0);

      return {
        name: `${c.username || c.user_id}`,
        value: `Tier: **${tier}** | Submissions: ${subs.length} | Paid: **${totalPaid.toLocaleString()} R$**`,
      };
    }));

    const embed = new EmbedBuilder()
      .setColor(GOLD)
      .setTitle(`Active Creators (${creators.length})`)
      .addFields(fields)
      .setFooter({ text: 'Godlyo Creator Program' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

// /markpaid
const markpaid = {
  data: new SlashCommandBuilder()
    .setName('markpaid')
    .setDescription('Mark a submission as paid (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt =>
      opt.setName('user').setDescription('The creator').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('submission_id').setDescription('Submission ID').setRequired(true)
    ),

  async execute(interaction) {
    await getDb();
    const target = interaction.options.getUser('user');
    const subId = interaction.options.getInteger('submission_id');

    const submission = get('SELECT * FROM submissions WHERE id = ? AND user_id = ?', [
      subId, target.id,
    ]);

    if (!submission) {
      return interaction.reply({
        embeds: [errorEmbed(`Submission #${subId} not found for <@${target.id}>.`)],
        ephemeral: true,
      });
    }

    if (submission.status === 'paid') {
      return interaction.reply({
        embeds: [errorEmbed('This submission is already marked as paid.')],
        ephemeral: true,
      });
    }

    run('UPDATE submissions SET status = ?, paid_at = ? WHERE id = ?', [
      'paid', new Date().toISOString(), subId,
    ]);

    // Post in creator's private channel
    const creator = get('SELECT * FROM creators WHERE user_id = ?', [target.id]);
    if (creator?.private_channel_id) {
      const creatorChannel = await interaction.guild.channels
        .fetch(creator.private_channel_id)
        .catch(() => null);
      if (creatorChannel) {
        await creatorChannel.send({ embeds: [paidEmbed(submission.robux_owed)] });
      }
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x2ECC71)
        .setDescription(`✅ Marked submission #${subId} as paid for <@${target.id}> — **${Number(submission.robux_owed).toLocaleString()} R$**`)],
      ephemeral: true,
    });
  },
};

// /removecreator
const removecreator = {
  data: new SlashCommandBuilder()
    .setName('removecreator')
    .setDescription('Remove a creator from the program (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt =>
      opt.setName('user').setDescription('The creator to remove').setRequired(true)
    ),

  async execute(interaction) {
    await getDb();
    const target = interaction.options.getUser('user');

    const creator = get('SELECT * FROM creators WHERE user_id = ?', [target.id]);
    if (!creator || creator.status !== 'accepted') {
      return interaction.reply({
        embeds: [errorEmbed(`<@${target.id}> is not an active creator.`)],
        ephemeral: true,
      });
    }

    // Revoke all tier roles + creator role
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) {
      const rolesToRemove = [
        process.env.CREATOR_ROLE_ID,
        process.env.TIER1_ROLE_ID,
        process.env.TIER2_ROLE_ID,
        process.env.TIER3_ROLE_ID,
      ].filter(Boolean);
      await member.roles.remove(rolesToRemove).catch(console.error);
    }

    // Delete private channel
    if (creator.private_channel_id) {
      const ch = await interaction.guild.channels
        .fetch(creator.private_channel_id)
        .catch(() => null);
      if (ch) await ch.delete().catch(console.error);
    }

    // Update DB
    run('UPDATE creators SET status = ?, private_channel_id = NULL WHERE user_id = ?', [
      'removed', target.id,
    ]);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xE74C3C)
        .setDescription(`✅ Removed <@${target.id}> from the Creator Program. Roles revoked and channel deleted.`)],
      ephemeral: true,
    });
  },
};

// /changetier
const changetier = {
  data: new SlashCommandBuilder()
    .setName('changetier')
    .setDescription('Change a creator\'s tier (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt =>
      opt.setName('user').setDescription('The creator').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('tier')
        .setDescription('New tier')
        .setRequired(true)
        .addChoices(
          { name: 'Tier 1 (10k+ followers) — 1,500 R$ per 10k views', value: 'tier1' },
          { name: 'Tier 2 (1k–10k followers) — 1,200 R$ per 10k views', value: 'tier2' },
          { name: 'Tier 3 (0–1k followers) — 1,000 R$ per 10k views', value: 'tier3' },
        )
    ),

  async execute(interaction) {
    await getDb();
    const target = interaction.options.getUser('user');
    const tier = interaction.options.getString('tier');

    const creator = get('SELECT * FROM creators WHERE user_id = ? AND status = ?', [
      target.id, 'accepted',
    ]);
    if (!creator) {
      return interaction.reply({
        embeds: [errorEmbed(`<@${target.id}> is not an active creator.`)],
        ephemeral: true,
      });
    }

    run('UPDATE creators SET tier = ? WHERE user_id = ?', [tier, target.id]);

    // Swap tier roles
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) {
      const allTierRoles = [
        process.env.TIER1_ROLE_ID,
        process.env.TIER2_ROLE_ID,
        process.env.TIER3_ROLE_ID,
      ].filter(Boolean);

      const newRoleId = process.env[`${tier.toUpperCase()}_ROLE_ID`];

      await member.roles.remove(allTierRoles).catch(console.error);
      if (newRoleId) await member.roles.add(newRoleId).catch(console.error);
    }

    const tierLabels = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3' };
    const rates = { tier1: '1,500', tier2: '1,200', tier3: '1,000' };

    // Notify in creator's private channel
    if (creator.private_channel_id) {
      const ch = await interaction.guild.channels
        .fetch(creator.private_channel_id)
        .catch(() => null);
      if (ch) {
        await ch.send({
          embeds: [new EmbedBuilder()
            .setColor(0xF5A623)
            .setTitle('Tier Updated 👑')
            .setDescription(
              `Your creator tier has been updated to **${tierLabels[tier]}**.\n` +
              `New payout rate: **${rates[tier]} R$ per 10,000 views**.`
            )],
        });
      }
    }

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x2ECC71)
        .setDescription(`✅ Updated <@${target.id}> to **${tierLabels[tier]}** — ${rates[tier]} R$ per 10k views.`)],
      ephemeral: true,
    });
  },
};

module.exports = { setfollowers, markpaid, creatorlist, removecreator, changetier };
