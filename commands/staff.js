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
    .addUserOption(opt => opt.setName('user').setDescription('The creator').setRequired(true))
    .addIntegerOption(opt => opt.setName('count').setDescription('Follower count').setRequired(true)),

  async execute(interaction) {
    await getDb();
    const target = interaction.options.getUser('user');
    const count = interaction.options.getInteger('count');
    const { name: tier } = getTier(count);
    run('UPDATE creators SET follower_count = ?, tier = ? WHERE user_id = ?', [count, tier.toLowerCase(), target.id]);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(GOLD).setDescription(`✅ Set follower count for <@${target.id}> to **${count.toLocaleString()}** — Tier: **${tier}**`)],
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
    if (creators.length === 0) return interaction.reply({ embeds: [errorEmbed('No active creators yet.')], ephemeral: true });

    const fields = await Promise.all(creators.map(async c => {
      const subs = all('SELECT * FROM submissions WHERE user_id = ?', [c.user_id]);
      const totalPaid = subs.filter(s => s.status === 'paid').reduce((sum, s) => sum + s.robux_owed, 0);
      const { name: tier } = getTier(c.tier || 'tier3');
      const rateInfo = c.custom_rate ? ` | Custom rate: ${c.custom_rate} R$/10k` : '';
      const capInfo = c.weekly_cap !== 15000 ? ` | Cap: ${(c.weekly_cap || 15000).toLocaleString()} R$/wk` : '';
      return {
        name: `${c.username || c.user_id}`,
        value: `Tier: **${tier}**${rateInfo}${capInfo} | Submissions: ${subs.length} | Paid: **${totalPaid.toLocaleString()} R$**`,
      };
    }));

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(GOLD).setTitle(`Active Creators (${creators.length})`).addFields(fields).setFooter({ text: 'Godlyo Creator Program' })],
      ephemeral: true,
    });
  },
};

// /markpaid — multiple submission IDs, comma separated
const markpaid = {
  data: new SlashCommandBuilder()
    .setName('markpaid')
    .setDescription('Mark one or more submissions as paid (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt => opt.setName('user').setDescription('The creator').setRequired(true))
    .addStringOption(opt =>
      opt.setName('submission_ids')
        .setDescription('Submission ID(s) — separate multiple with commas e.g. 1,2,3')
        .setRequired(true)
    ),

  async execute(interaction) {
    await getDb();
    const target = interaction.options.getUser('user');
    const idsRaw = interaction.options.getString('submission_ids');
    const ids = idsRaw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

    if (ids.length === 0) {
      return interaction.reply({ embeds: [errorEmbed('No valid submission IDs provided.')], ephemeral: true });
    }

    const creator = get('SELECT * FROM creators WHERE user_id = ?', [target.id]);
    if (!creator) return interaction.reply({ embeds: [errorEmbed(`Creator not found.`)], ephemeral: true });

    let totalRobux = 0;
    const processed = [];
    const failed = [];

    for (const id of ids) {
      const sub = get('SELECT * FROM submissions WHERE id = ? AND user_id = ?', [id, target.id]);
      if (!sub) { failed.push(id); continue; }
      if (sub.status === 'paid') { failed.push(id); continue; }
      run('UPDATE submissions SET status = ?, paid_at = ? WHERE id = ?', ['paid', new Date().toISOString(), id]);
      totalRobux += sub.robux_owed || 0;
      processed.push(id);
    }

    // Check minimum payout
    if (totalRobux < 1000) {
      // Rollback
      for (const id of processed) {
        run('UPDATE submissions SET status = ?, paid_at = NULL WHERE id = ?', ['verified', id]);
      }
      return interaction.reply({
        embeds: [errorEmbed(`Total payout of **${totalRobux.toLocaleString()} R$** is below the minimum of **1,000 R$**. Add more submissions or wait until the creator has enough.`)],
        ephemeral: true,
      });
    }

    // Notify in creator channel
    if (creator.private_channel_id) {
      const ch = await interaction.guild.channels.fetch(creator.private_channel_id).catch(() => null);
      if (ch) {
        await ch.send({
          embeds: [new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('Payout Sent 💰')
            .setDescription(
              `Your Robux payout of **${Math.floor(totalRobux).toLocaleString()} R$** has been sent!\n` +
              `Submissions: ${processed.map(id => `#${id}`).join(', ')}\n\n` +
              `Check your Roblox account!`
            )
            .setFooter({ text: 'Thank you for creating content for Godlyo 👑' })],
        });
      }
    }

    const failText = failed.length > 0 ? `\nSkipped (not found or already paid): ${failed.map(id => `#${id}`).join(', ')}` : '';
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x2ECC71)
        .setDescription(`✅ Marked submissions ${processed.map(id => `#${id}`).join(', ')} as paid for <@${target.id}> — **${Math.floor(totalRobux).toLocaleString()} R$** total${failText}`)],
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
    .addUserOption(opt => opt.setName('user').setDescription('The creator to remove').setRequired(true)),

  async execute(interaction) {
    await getDb();
    const target = interaction.options.getUser('user');
    const creator = get('SELECT * FROM creators WHERE user_id = ?', [target.id]);
    if (!creator || creator.status !== 'accepted') {
      return interaction.reply({ embeds: [errorEmbed(`<@${target.id}> is not an active creator.`)], ephemeral: true });
    }

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) {
      const rolesToRemove = [process.env.CREATOR_ROLE_ID, process.env.TIER1_ROLE_ID, process.env.TIER2_ROLE_ID, process.env.TIER3_ROLE_ID].filter(Boolean);
      await member.roles.remove(rolesToRemove).catch(console.error);
    }

    if (creator.private_channel_id) {
      const ch = await interaction.guild.channels.fetch(creator.private_channel_id).catch(() => null);
      if (ch) await ch.delete().catch(console.error);
    }

    run('UPDATE creators SET status = ?, private_channel_id = NULL WHERE user_id = ?', ['removed', target.id]);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription(`✅ Removed <@${target.id}> from the Creator Program.`)],
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
    .addUserOption(opt => opt.setName('user').setDescription('The creator').setRequired(true))
    .addStringOption(opt =>
      opt.setName('tier').setDescription('New tier').setRequired(true)
        .addChoices(
          { name: 'Tier 1 (10k+) — 1,500 R$ per 10k views', value: 'tier1' },
          { name: 'Tier 2 (1k–10k) — 1,200 R$ per 10k views', value: 'tier2' },
          { name: 'Tier 3 (0–1k) — 1,000 R$ per 10k views', value: 'tier3' },
        )
    ),

  async execute(interaction) {
    await getDb();
    const target = interaction.options.getUser('user');
    const tier = interaction.options.getString('tier');
    const creator = get('SELECT * FROM creators WHERE user_id = ? AND status = ?', [target.id, 'accepted']);
    if (!creator) return interaction.reply({ embeds: [errorEmbed(`<@${target.id}> is not an active creator.`)], ephemeral: true });

    run('UPDATE creators SET tier = ? WHERE user_id = ?', [tier, target.id]);

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (member) {
      const allTierRoles = [process.env.TIER1_ROLE_ID, process.env.TIER2_ROLE_ID, process.env.TIER3_ROLE_ID].filter(Boolean);
      const newRoleId = process.env[`${tier.toUpperCase()}_ROLE_ID`];
      await member.roles.remove(allTierRoles).catch(console.error);
      if (newRoleId) await member.roles.add(newRoleId).catch(console.error);
    }

    const tierLabels = { tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3' };
    const rates = { tier1: '1,500', tier2: '1,200', tier3: '1,000' };

    if (creator.private_channel_id) {
      const ch = await interaction.guild.channels.fetch(creator.private_channel_id).catch(() => null);
      if (ch) {
        await ch.send({
          embeds: [new EmbedBuilder().setColor(GOLD).setTitle('Tier Updated 👑')
            .setDescription(`Your creator tier has been updated to **${tierLabels[tier]}**.\nNew payout rate: **${rates[tier]} R$ per 10,000 views**.`)],
        });
      }
    }

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ Updated <@${target.id}> to **${tierLabels[tier]}**.`)],
      ephemeral: true,
    });
  },
};

// /setrate
const setrate = {
  data: new SlashCommandBuilder()
    .setName('setrate')
    .setDescription('Set a custom payout rate for a creator (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt => opt.setName('user').setDescription('The creator').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('rate').setDescription('Custom rate in R$ per 10,000 views (set 0 to reset to tier default)').setRequired(true)
    ),

  async execute(interaction) {
    await getDb();
    const target = interaction.options.getUser('user');
    const rate = interaction.options.getInteger('rate');
    const creator = get('SELECT * FROM creators WHERE user_id = ? AND status = ?', [target.id, 'accepted']);
    if (!creator) return interaction.reply({ embeds: [errorEmbed(`<@${target.id}> is not an active creator.`)], ephemeral: true });

    const newRate = rate === 0 ? null : rate;
    run('UPDATE creators SET custom_rate = ? WHERE user_id = ?', [newRate, target.id]);

    const rateText = newRate ? `**${newRate.toLocaleString()} R$ per 10,000 views** (custom)` : `tier default`;

    if (creator.private_channel_id) {
      const ch = await interaction.guild.channels.fetch(creator.private_channel_id).catch(() => null);
      if (ch) {
        await ch.send({
          embeds: [new EmbedBuilder().setColor(GOLD).setTitle('Payout Rate Updated 👑')
            .setDescription(
              newRate
                ? `Your payout rate has been updated to **${newRate.toLocaleString()} R$ per 10,000 views**.\n\nThis is a custom rate based on your performance. Keep it up! 🔥`
                : `Your payout rate has been reset to the tier default.`
            )],
        });
      }
    }

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ Set rate for <@${target.id}> to ${rateText}.`)],
      ephemeral: true,
    });
  },
};

// /setcap
const setcap = {
  data: new SlashCommandBuilder()
    .setName('setcap')
    .setDescription('Set a creator\'s weekly Robux cap (staff only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(opt => opt.setName('user').setDescription('The creator').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('cap').setDescription('Weekly cap in R$ (default is 15,000)').setRequired(true)
    ),

  async execute(interaction) {
    await getDb();
    const target = interaction.options.getUser('user');
    const cap = interaction.options.getInteger('cap');
    const creator = get('SELECT * FROM creators WHERE user_id = ? AND status = ?', [target.id, 'accepted']);
    if (!creator) return interaction.reply({ embeds: [errorEmbed(`<@${target.id}> is not an active creator.`)], ephemeral: true });

    run('UPDATE creators SET weekly_cap = ? WHERE user_id = ?', [cap, target.id]);

    if (creator.private_channel_id) {
      const ch = await interaction.guild.channels.fetch(creator.private_channel_id).catch(() => null);
      if (ch) {
        await ch.send({
          embeds: [new EmbedBuilder().setColor(GOLD).setTitle('Weekly Cap Updated 👑')
            .setDescription(`Your weekly Robux cap has been updated to **${cap.toLocaleString()} R$** per week.\n\nThis resets every Monday.`)],
        });
      }
    }

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ Set weekly cap for <@${target.id}> to **${cap.toLocaleString()} R$**.`)],
      ephemeral: true,
    });
  },
};

module.exports = { setfollowers, markpaid, creatorlist, removecreator, changetier, setrate, setcap };
