const axios = require('axios');

/**
 * Parse platform from URL
 * @returns 'youtube' | 'tiktok' | 'instagram' | null
 */
function parsePlatform(url) {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('instagram.com')) return 'instagram';
  return null;
}

/**
 * Extract YouTube video ID from URL
 */
function extractYoutubeId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/shorts\/([^?]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Fetch YouTube video data
 * Returns: { views, publishedAt, followers, channelTitle }
 */
async function fetchYoutube(videoUrl) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const videoId = extractYoutubeId(videoUrl);
  if (!videoId) throw new Error('Could not parse YouTube video ID from URL.');

  const videoRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
    params: {
      key: apiKey,
      id: videoId,
      part: 'snippet,statistics',
    },
  });

  const item = videoRes.data.items?.[0];
  if (!item) throw new Error('Video not found on YouTube.');

  const views = parseInt(item.statistics.viewCount, 10);
  const publishedAt = new Date(item.snippet.publishedAt);
  const channelId = item.snippet.channelId;

  const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
    params: {
      key: apiKey,
      id: channelId,
      part: 'statistics,snippet',
    },
  });

  const channel = channelRes.data.items?.[0];
  const followers = parseInt(channel?.statistics?.subscriberCount || '0', 10);
  const channelTitle = channel?.snippet?.title || 'Unknown';

  return { views, publishedAt, followers, channelTitle };
}

/**
 * Extract TikTok video ID from URL
 */
function extractTiktokId(url) {
  const m = url.match(/video\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Fetch TikTok video data via Research API
 * Returns: { views, publishedAt, followers }
 */
async function fetchTiktok(videoUrl) {
  const apiKey = process.env.TIKTOK_API_KEY;
  const videoId = extractTiktokId(videoUrl);
  if (!videoId) throw new Error('Could not parse TikTok video ID from URL.');

  // TikTok Research API — requires approved developer access
  const videoRes = await axios.post(
    'https://open.tiktokapis.com/v2/research/video/query/',
    {
      query: { and: [{ operation: 'EQ', field_name: 'id', field_values: [videoId] }] },
      start_date: '20200101',
      end_date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
      max_count: 1,
      fields: 'id,create_time,view_count,author_info',
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const video = videoRes.data.data?.videos?.[0];
  if (!video) throw new Error('Video not found on TikTok.');

  const views = video.view_count || 0;
  const publishedAt = new Date(video.create_time * 1000);

  // Fetch user followers
  const username = videoUrl.match(/@([^/]+)/)?.[1];
  let followers = 0;
  if (username) {
    const userRes = await axios.get(
      'https://open.tiktokapis.com/v2/research/user/info/',
      {
        params: { fields: 'follower_count', username },
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    followers = userRes.data.data?.user_info?.follower_count || 0;
  }

  return { views, publishedAt, followers };
}

/**
 * Extract Instagram media ID from URL
 */
function extractInstagramId(url) {
  const m = url.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[2] : null;
}

/**
 * Fetch Instagram video data via Meta Graph API
 * Only works for Business/Creator accounts connected to a FB Page
 * Returns: { views, publishedAt, followers }
 */
async function fetchInstagram(videoUrl) {
  const token = process.env.META_ACCESS_TOKEN;
  const shortcode = extractInstagramId(videoUrl);
  if (!shortcode) throw new Error('Could not parse Instagram post ID from URL.');

  // Get media ID from shortcode using oEmbed
  const oembedRes = await axios.get('https://graph.facebook.com/v18.0/instagram_oembed', {
    params: { url: videoUrl, access_token: token },
  });

  // Get the actual media via Graph API search
  const mediaRes = await axios.get(`https://graph.facebook.com/v18.0/${shortcode}`, {
    params: {
      fields: 'timestamp,video_views,like_count',
      access_token: token,
    },
  });

  const views = mediaRes.data.video_views || 0;
  const publishedAt = new Date(mediaRes.data.timestamp);

  // Get owner followers
  const ownerRes = await axios.get(`https://graph.facebook.com/v18.0/me`, {
    params: { fields: 'followers_count', access_token: token },
  });
  const followers = ownerRes.data.followers_count || 0;

  return { views, publishedAt, followers };
}

/**
 * Main fetch dispatcher
 */
async function fetchVideoData(url) {
  const platform = parsePlatform(url);
  if (!platform) return { error: 'Unsupported platform. Supported: TikTok, YouTube, Instagram.' };

  try {
    let data;
    if (platform === 'youtube') data = await fetchYoutube(url);
    else if (platform === 'tiktok') data = await fetchTiktok(url);
    else if (platform === 'instagram') data = await fetchInstagram(url);

    return { platform, ...data };
  } catch (err) {
    return { error: err.message || 'Failed to fetch video data from platform API.' };
  }
}

module.exports = { parsePlatform, fetchVideoData };
