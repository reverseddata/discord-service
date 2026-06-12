const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { getDb, get, run } = require('../utils/db');
const {
  applicationEmbed, welcomeEmbed,
  approvedEmbed, rejectedSubmissionEmbed,
  errorEmbed,
} = require('../utils/embeds');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {
    // ─── Slash Commands ─────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      // Staff commands are exported differently
      const staffCmds = ['setfollowers', 'creatorlist', 'markpaid', 'removecreator', 'changetier', 'setrate', 'setcap'];
      if (staffCmds.includes(interaction.commandName)) {
        const staffModule = require('../commands/staff.js');
        const cmd = staffModule[interaction.commandName.replace('-', '')];
        if (cmd) return cmd.execute(interaction);
      }

      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        const msg = { embeds: [errorEmbed('Something went wrong.')], ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(msg);
        } else {
          await interaction.reply(msg);
        }
      }
      return;
    }

    // ─── Button: Open Application Modal ─────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'open_application') {
      const modal = new ModalBuilder()
        .setCustomId('creator_application_modal')
        .setTitle('Godlyo Creator Application');

      const channelInput = new TextInputBuilder()
        .setCustomId('channel_link')
        .setLabel('Channel / Account Link')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://tiktok.com/@yourname')
        .setRequired(true);

      const viewsInput = new TextInputBuilder()
        .setCustomId('avg_views')
        .setLabel('Average Views per Video')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. 500, 2000, 10000')
        .setRequired(true);

      const contentInput = new TextInputBuilder()
        .setCustomId('content_type')
        .setLabel('Content Type')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('MM2 Trades / MM2 General / Roblox General')
        .setRequired(true);

      const termsInput = new TextInputBuilder()
        .setCustomId('terms_agree')
        .setLabel('Type YES to agree to the Creator Terms')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('YES')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(channelInput),
        new ActionRowBuilder().addComponents(viewsInput),
        new ActionRowBuilder().addComponents(contentInput),
        new ActionRowBuilder().addComponents(termsInput)
      );

      return interaction.showModal(modal);
    }

    // ─── Modal Submit: Creator Application ──────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'creator_application_modal') {
      const channelLink = interaction.fields.getTextInputValue('channel_link');
      const avgViews = interaction.fields.getTextInputValue('avg_views');
      const contentType = interaction.fields.getTextInputValue('content_type');
      const terms = interaction.fields.getTextInputValue('terms_agree');

      if (terms.trim().toUpperCase() !== 'YES') {
        return interaction.reply({
          embeds: [errorEmbed('You must agree to the Creator Terms to apply. Type YES in the last field.')],
          ephemeral: true,
        });
      }

      await getDb();

      // Check for existing pending/accepted application
      const existing = get('SELECT * FROM creators WHERE user_id = ?', [interaction.user.id]);
      if (existing && existing.status === 'pending') {
        return interaction.reply({
          embeds: [errorEmbed('You already have a pending application. Please wait for a decision.')],
          ephemeral: true,
        });
      }
      if (existing && existing.status === 'accepted') {
        return interaction.reply({
          embeds: [errorEmbed('You are already an accepted creator!')],
          ephemeral: true,
        });
      }

      // Save to DB (upsert)
      if (existing) {
        run(
          'UPDATE creators SET username=?, channel_link=?, avg_views=?, content_type=?, status=? WHERE user_id=?',
          [interaction.user.tag, channelLink, avgViews, contentType, 'pending', interaction.user.id]
        );
      } else {
        run(
          'INSERT INTO creators (user_id, username, channel_link, avg_views, content_type, status) VALUES (?,?,?,?,?,?)',
          [interaction.user.id, interaction.user.tag, channelLink, avgViews, contentType, 'pending']
        );
      }

      // Post in applications channel
      const appChannel = await interaction.guild.channels
        .fetch(process.env.CREATOR_APPLICATIONS_CHANNEL_ID)
        .catch(() => null);

      if (appChannel) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`accept_application_${interaction.user.id}`)
            .setLabel('Accept')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`reject_application_${interaction.user.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
        );

        await appChannel.send({
          embeds: [applicationEmbed(interaction.user, { channelLink, avgViews, contentType })],
          components: [row],
        });
      }

      return interaction.reply({
        embeds: [{
          color: 0xF5A623,
          title: 'Application Submitted 👑',
          description: 'Your application has been received! We\'ll review it within 24 hours.',
          footer: { text: 'Godlyo Creator Program • godlyo.com' },
        }],
        ephemeral: true,
      });
    }

    // ─── Button: Accept Application ─────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('accept_application_')) {
      const staffMember = interaction.member;
      const hasStaffRole = staffMember.roles.cache.has(process.env.STAFF_ROLE_ID);
      const isAdmin = staffMember.permissions.has(PermissionFlagsBits.ManageRoles);
      if (!hasStaffRole && !isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('You do not have permission.')], ephemeral: true });
      }

      const userId = interaction.customId.replace('accept_application_', '');
      await getDb();

      const creator = get('SELECT * FROM creators WHERE user_id = ?', [userId]);
      if (!creator) return interaction.reply({ embeds: [errorEmbed('Creator not found.')], ephemeral: true });
      if (creator.status === 'accepted') {
        return interaction.reply({ embeds: [errorEmbed('Already accepted.')], ephemeral: true });
      }

      // Assign Creator role + default Tier 3 role
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member) {
        const rolesToAdd = [process.env.CREATOR_ROLE_ID, process.env.TIER3_ROLE_ID].filter(Boolean);
        await member.roles.add(rolesToAdd).catch(e => console.error('Role assignment failed:', e.message));
      } else {
        console.error('Could not fetch member:', userId);
      }

      // Create private channel
      const safeName = (creator.username || userId).replace(/[^a-z0-9]/gi, '').toLowerCase();
      const channelName = `creator-${safeName}`;

      const privateChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: process.env.CREATOR_CATEGORY_ID || null,
        permissionOverwrites: [
          {
            id: interaction.guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: userId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          },
          {
            id: process.env.STAFF_ROLE_ID,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          },
        ],
      });

      // Update DB
      run('UPDATE creators SET status=?, private_channel_id=?, accepted_at=? WHERE user_id=?', [
        'accepted', privateChannel.id, new Date().toISOString(), userId,
      ]);

      // Send welcome embed in private channel
      await privateChannel.send({
        content: `<@${userId}>`,
        embeds: [welcomeEmbed()],
      });

      // Update original message
      await interaction.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('done')
              .setLabel(`✅ Accepted by ${interaction.user.tag}`)
              .setStyle(ButtonStyle.Success)
              .setDisabled(true)
          ),
        ],
      });
    }

    // ─── Button: Reject Application ─────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('reject_application_')) {
      const staffMember = interaction.member;
      const hasStaffRole = staffMember.roles.cache.has(process.env.STAFF_ROLE_ID);
      const isAdmin = staffMember.permissions.has(PermissionFlagsBits.ManageRoles);
      if (!hasStaffRole && !isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('You do not have permission.')], ephemeral: true });
      }

      const userId = interaction.customId.replace('reject_application_', '');
      await getDb();

      run('UPDATE creators SET status=? WHERE user_id=?', ['rejected', userId]);

      // DM the user
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (member) {
        await member.send(
          "Your Godlyo Creator application was not accepted at this time. You're welcome to reapply in the future."
        ).catch(() => {});
      }

      await interaction.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('done')
              .setLabel(`❌ Rejected by ${interaction.user.tag}`)
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          ),
        ],
      });
    }

    // ─── Button: Approve Submission ──────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('approve_submission_')) {
      const staffMember = interaction.member;
      const hasStaffRole = staffMember.roles.cache.has(process.env.STAFF_ROLE_ID);
      const isAdmin = staffMember.permissions.has(PermissionFlagsBits.ManageRoles);
      if (!hasStaffRole && !isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('You do not have permission.')], ephemeral: true });
      }

      const subId = interaction.customId.replace('approve_submission_', '');
      await getDb();

      const submission = get('SELECT * FROM submissions WHERE id = ?', [subId]);
      if (!submission) return interaction.reply({ embeds: [errorEmbed('Submission not found.')], ephemeral: true });

      run('UPDATE submissions SET status=?, reviewed_at=? WHERE id=?', [
        'verified', new Date().toISOString(), subId,
      ]);

      const creator = get('SELECT * FROM creators WHERE user_id=?', [submission.user_id]);
      if (creator?.private_channel_id) {
        const ch = await interaction.guild.channels.fetch(creator.private_channel_id).catch(() => null);
        if (ch) {
          await ch.send({
            embeds: [approvedEmbed(submission.video_url, submission.views_at_submission, submission.robux_owed)],
          });
        }
      }

      await interaction.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('done')
              .setLabel(`✅ Approved by ${interaction.user.tag}`)
              .setStyle(ButtonStyle.Success)
              .setDisabled(true)
          ),
        ],
      });
    }

    // ─── Button: Reject Submission ───────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('reject_submission_')) {
      const staffMember = interaction.member;
      const hasStaffRole = staffMember.roles.cache.has(process.env.STAFF_ROLE_ID);
      const isAdmin = staffMember.permissions.has(PermissionFlagsBits.ManageRoles);
      if (!hasStaffRole && !isAdmin) {
        return interaction.reply({ embeds: [errorEmbed('You do not have permission.')], ephemeral: true });
      }

      const subId = interaction.customId.replace('reject_submission_', '');
      await getDb();

      const submission = get('SELECT * FROM submissions WHERE id = ?', [subId]);
      if (!submission) return interaction.reply({ embeds: [errorEmbed('Submission not found.')], ephemeral: true });

      run('UPDATE submissions SET status=?, reviewed_at=? WHERE id=?', [
        'rejected', new Date().toISOString(), subId,
      ]);

      const creator = get('SELECT * FROM creators WHERE user_id=?', [submission.user_id]);
      if (creator?.private_channel_id) {
        const ch = await interaction.guild.channels.fetch(creator.private_channel_id).catch(() => null);
        if (ch) {
          await ch.send({ embeds: [rejectedSubmissionEmbed()] });
        }
      }

      await interaction.update({
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('done')
              .setLabel(`❌ Rejected by ${interaction.user.tag}`)
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true)
          ),
        ],
      });
    }
  },
};
