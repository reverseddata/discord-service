# Godlyo Creator Bot

Discord bot for the Godlyo Creator Program. Handles applications, video submissions, view verification, and payout tracking.

## Stack

- **discord.js v14**
- **sql.js** (SQLite, pure JS — no native bindings needed)
- **axios** for platform API calls

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in all values in `.env`:

| Variable | Where to get it |
|---|---|
| `BOT_TOKEN` | Discord Developer Portal → Your App → Bot → Token |
| `GUILD_ID` | Right-click your server → Copy Server ID |
| `STAFF_ROLE_ID` | Right-click the Staff role → Copy Role ID |
| `CREATOR_ROLE_ID` | Right-click the Creator role → Copy Role ID |
| `CREATOR_APPLICATIONS_CHANNEL_ID` | Right-click `#creator-applications` → Copy Channel ID |
| `CREATOR_SUBMISSIONS_CHANNEL_ID` | Right-click `#creator-submissions` → Copy Channel ID |
| `CREATOR_CATEGORY_ID` | Right-click the Creator category → Copy Category ID |
| `YOUTUBE_API_KEY` | Google Cloud Console → YouTube Data API v3 |
| `TIKTOK_API_KEY` | TikTok Developer Portal → Research API |
| `META_ACCESS_TOKEN` | Meta for Developers → Graph API access token |

### 3. Discord bot permissions

Required permissions when inviting the bot:
- Manage Channels
- Manage Roles
- Send Messages
- Read Messages / View Channels
- Use Slash Commands
- Send Messages in Threads

Enable **Server Members Intent** and **Message Content Intent** in the Developer Portal.

### 4. Run

```bash
node index.js
```

For production (auto-restart):
```bash
npm install -g pm2
pm2 start index.js --name godlyo-bot
pm2 save
```

---

## Commands

### Creator Commands

| Command | Description |
|---|---|
| `/submit [video_url]` | Submit a video for review (in your private channel only) |
| `/payout-history` | View your submission and payout history |

### Staff Commands

| Command | Description |
|---|---|
| `/apply-setup` | Post the application button in a channel |
| `/setfollowers @user [count]` | Manually set a creator's follower count |
| `/creatorlist` | List all active creators |
| `/markpaid @user [submission_id]` | Mark a submission as paid |

---

## Flow

```
Creator clicks "Submit Application"
  → Fills out modal (channel, avg views, content type, terms)
  → Application embed posted in #creator-applications with Accept/Reject buttons

Staff clicks Accept
  → Creator gets @Creator role
  → Private channel created: creator-[username]
  → Welcome embed posted in channel

Creator uses /submit [url]
  → Bot fetches views + followers + publish date from platform API
  → Checks 72h window
  → Calculates Robux (Nano/Micro/Mid tier)
  → Submission embed posted in #creator-submissions with Approve/Reject buttons

Staff clicks Approve
  → Creator's channel updated with approval + robux amount

Staff uses /markpaid
  → Submission marked paid
  → Creator's channel notified
```

---

## Tier & Payout Rates

| Tier | Followers | Rate |
|---|---|---|
| Nano | 0 – 999 | 1,000 R$ per 10k views |
| Micro | 1,000 – 9,999 | 1,200 R$ per 10k views |
| Mid | 10,000+ | 1,500 R$ per 10k views |

Formula: `robux = (views / 10000) * tier_rate`

---

## Platform API Notes

- **YouTube**: Works out of the box with a YouTube Data API v3 key (free, 10k units/day)
- **TikTok**: Requires approved TikTok Research API access (apply at developers.tiktok.com)
- **Instagram**: Only works for Business/Creator accounts connected to a Facebook Page — limited

## Hosting

Railway or Hetzner CX11 (~4€/month) work well. SQLite database is stored in `data/godlyo.db`.
