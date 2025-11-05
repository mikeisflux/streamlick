import { Router } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { encrypt, decrypt } from '../utils/crypto';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// OAuth URLs
const YOUTUBE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
].join(' ');

const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';
const FACEBOOK_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token';
const FACEBOOK_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'].join(',');

const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/authorize';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_SCOPES = ['channel:read:stream_key', 'chat:read'].join(' ');

const X_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const X_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'].join(' ');

const RUMBLE_AUTH_URL = 'https://rumble.com/service.php';
const RUMBLE_TOKEN_URL = 'https://rumble.com/service.php';
// Rumble uses API key authentication primarily

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_SCOPES = ['w_member_social', 'r_liteprofile', 'r_organization_social', 'w_organization_social'].join(' ');

/**
 * YouTube OAuth Flow
 */

// Step 1: Initiate YouTube OAuth
router.get('/youtube/authorize', authenticate, (req, res) => {
  const userId = req.user!.id;
  const state = Buffer.from(JSON.stringify({ userId, platform: 'youtube' })).toString('base64');

  const params = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID || '',
    redirect_uri: process.env.YOUTUBE_REDIRECT_URI || '',
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `${YOUTUBE_AUTH_URL}?${params.toString()}`;
  res.json({ url: authUrl });
});

// Step 2: YouTube OAuth Callback
router.get('/youtube/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    // Decode state
    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    // Exchange code for tokens
    const tokenResponse = await axios.post(YOUTUBE_TOKEN_URL, {
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      redirect_uri: process.env.YOUTUBE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get YouTube channel info
    const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet', mine: true },
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const channel = channelResponse.data.items?.[0];
    if (!channel) {
      return res.status(400).json({ error: 'No YouTube channel found' });
    }

    // Get stream key
    const streamKeyResponse = await axios.get('https://www.googleapis.com/youtube/v3/liveStreams', {
      params: { part: 'cdn', mine: true },
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const streamKey = streamKeyResponse.data.items?.[0]?.cdn?.ingestionInfo?.streamName || '';

    // Store destination
    await prisma.destination.create({
      data: {
        userId,
        platform: 'youtube',
        name: channel.snippet.title,
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
        streamKey: encrypt(streamKey),
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        isEnabled: true,
      },
    });

    logger.info(`YouTube OAuth completed for user ${userId}`);

    // Redirect to settings page
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=destinations&success=youtube`);
  } catch (error) {
    logger.error('YouTube OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=destinations&error=youtube`);
  }
});

/**
 * Facebook OAuth Flow
 */

// Step 1: Initiate Facebook OAuth
router.get('/facebook/authorize', authenticate, (req, res) => {
  const userId = req.user!.id;
  const state = Buffer.from(JSON.stringify({ userId, platform: 'facebook' })).toString('base64');

  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID || '',
    redirect_uri: process.env.FACEBOOK_REDIRECT_URI || '',
    state,
    scope: FACEBOOK_SCOPES,
  });

  const authUrl = `${FACEBOOK_AUTH_URL}?${params.toString()}`;
  res.json({ url: authUrl });
});

// Step 2: Facebook OAuth Callback
router.get('/facebook/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    // Exchange code for token
    const tokenResponse = await axios.get(FACEBOOK_TOKEN_URL, {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
        code,
      },
    });

    const { access_token } = tokenResponse.data;

    // Get user's pages
    const pagesResponse = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: { access_token },
    });

    const page = pagesResponse.data.data?.[0];
    if (!page) {
      return res.status(400).json({ error: 'No Facebook page found' });
    }

    // Get page access token
    const pageAccessToken = page.access_token;

    // Get live video stream key
    const streamKeyResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${page.id}/live_videos`,
      {
        params: {
          access_token: pageAccessToken,
          fields: 'stream_url,secure_stream_url',
        },
      }
    );

    const streamUrl = streamKeyResponse.data.data?.[0]?.secure_stream_url ||
                      'rtmps://live-api-s.facebook.com:443/rtmp/';

    // Store destination
    await prisma.destination.create({
      data: {
        userId,
        platform: 'facebook',
        name: page.name,
        rtmpUrl: streamUrl,
        streamKey: encrypt(''), // Facebook uses URL-based keys
        accessToken: encrypt(pageAccessToken),
        refreshToken: null,
        expiresAt: null, // Page tokens don't expire
        isEnabled: true,
      },
    });

    logger.info(`Facebook OAuth completed for user ${userId}`);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=destinations&success=facebook`);
  } catch (error) {
    logger.error('Facebook OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=destinations&error=facebook`);
  }
});

/**
 * Twitch OAuth Flow
 */

// Step 1: Initiate Twitch OAuth
router.get('/twitch/authorize', authenticate, (req, res) => {
  const userId = req.user!.id;
  const state = Buffer.from(JSON.stringify({ userId, platform: 'twitch' })).toString('base64');

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID || '',
    redirect_uri: process.env.TWITCH_REDIRECT_URI || '',
    response_type: 'code',
    scope: TWITCH_SCOPES,
    state,
  });

  const authUrl = `${TWITCH_AUTH_URL}?${params.toString()}`;
  res.json({ url: authUrl });
});

// Step 2: Twitch OAuth Callback
router.get('/twitch/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    // Exchange code for token
    const tokenResponse = await axios.post(TWITCH_TOKEN_URL, {
      client_id: process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.TWITCH_REDIRECT_URI,
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID || '',
      },
    });

    const twitchUser = userResponse.data.data?.[0];
    if (!twitchUser) {
      return res.status(400).json({ error: 'Twitch user not found' });
    }

    // Get stream key
    const streamKeyResponse = await axios.get(
      `https://api.twitch.tv/helix/streams/key?broadcaster_id=${twitchUser.id}`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID || '',
        },
      }
    );

    const streamKey = streamKeyResponse.data.data?.[0]?.stream_key || '';

    // Store destination
    await prisma.destination.create({
      data: {
        userId,
        platform: 'twitch',
        name: twitchUser.display_name,
        rtmpUrl: `rtmp://live.twitch.tv/app`,
        streamKey: encrypt(streamKey),
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
        expiresAt: null, // Twitch tokens don't have explicit expiry
        isEnabled: true,
      },
    });

    logger.info(`Twitch OAuth completed for user ${userId}`);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=destinations&success=twitch`);
  } catch (error) {
    logger.error('Twitch OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=destinations&error=twitch`);
  }
});

/**
 * X (Twitter) OAuth Flow
 */

// Step 1: Initiate X OAuth
router.get('/x/authorize', authenticate, (req, res) => {
  const userId = req.user!.id;
  const state = Buffer.from(JSON.stringify({ userId, platform: 'x' })).toString('base64');

  // Generate PKCE code verifier and challenge
  const codeVerifier = Buffer.from(Math.random().toString()).toString('base64').substring(0, 128);
  const codeChallenge = Buffer.from(codeVerifier).toString('base64url');

  // Store code verifier in session/cache (in production, use Redis)
  // For now, we'll include it in state (not secure for production)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.X_CLIENT_ID || '',
    redirect_uri: process.env.X_REDIRECT_URI || '',
    scope: X_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `${X_AUTH_URL}?${params.toString()}`;
  res.json({ url: authUrl });
});

// Step 2: X OAuth Callback
router.get('/x/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    // Exchange code for token (with PKCE)
    const tokenResponse = await axios.post(
      X_TOKEN_URL,
      {
        code,
        grant_type: 'authorization_code',
        client_id: process.env.X_CLIENT_ID,
        redirect_uri: process.env.X_REDIRECT_URI,
        code_verifier: 'STORED_CODE_VERIFIER', // Should retrieve from cache
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const xUser = userResponse.data.data;
    if (!xUser) {
      return res.status(400).json({ error: 'X user not found' });
    }

    // X doesn't provide stream keys via API - users need to set up manually via Media Studio
    // Store destination with placeholder
    await prisma.destination.create({
      data: {
        userId,
        platform: 'x',
        name: `@${xUser.username}`,
        rtmpUrl: 'rtmp://fa.contribute.live-video.net/app', // X/Twitter Media Studio RTMP
        streamKey: encrypt(''), // User must get from Media Studio
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
        expiresAt: null,
        isEnabled: true,
      },
    });

    logger.info(`X OAuth completed for user ${userId}`);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=destinations&success=x`);
  } catch (error) {
    logger.error('X OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=destinations&error=x`);
  }
});

/**
 * Rumble OAuth Flow
 * Note: Rumble primarily uses API key authentication rather than OAuth
 * This is a simplified flow for API key setup
 */

// Step 1: Setup Rumble with API Key
router.post('/rumble/setup', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { apiKey, channelUrl } = req.body;

    if (!apiKey || !channelUrl) {
      return res.status(400).json({ error: 'API key and channel URL required' });
    }

    // Verify API key by making test request
    const testResponse = await axios.get('https://rumble.com/service.php', {
      params: {
        name: 'user.get',
        key: apiKey,
      },
    });

    if (!testResponse.data || testResponse.data.error) {
      return res.status(400).json({ error: 'Invalid Rumble API key' });
    }

    const userData = testResponse.data;

    // Get stream key
    const streamResponse = await axios.get('https://rumble.com/service.php', {
      params: {
        name: 'live.get_stream_key',
        key: apiKey,
      },
    });

    const streamKey = streamResponse.data?.stream_key || '';
    const rtmpUrl = streamResponse.data?.rtmp_url || 'rtmp://d.rumble.com/live';

    // Store destination
    await prisma.destination.create({
      data: {
        userId,
        platform: 'rumble',
        name: userData.username || 'Rumble',
        rtmpUrl,
        streamKey: encrypt(streamKey),
        accessToken: encrypt(apiKey), // Store API key as access token
        refreshToken: null,
        expiresAt: null,
        isEnabled: true,
      },
    });

    logger.info(`Rumble setup completed for user ${userId}`);
    res.json({ success: true, message: 'Rumble connected successfully' });
  } catch (error: any) {
    logger.error('Rumble setup error:', error);
    res.status(500).json({ error: 'Failed to setup Rumble: ' + error.message });
  }
});

/**
 * LinkedIn OAuth Flow
 */

// Step 1: Initiate LinkedIn OAuth
router.get('/linkedin/authorize', authenticate, (req, res) => {
  const userId = req.user!.id;
  const state = Buffer.from(JSON.stringify({ userId, platform: 'linkedin' })).toString('base64');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID || '',
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI || '',
    state,
    scope: LINKEDIN_SCOPES,
  });

  const authUrl = `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  res.json({ url: authUrl });
});

// Step 2: LinkedIn OAuth Callback
router.get('/linkedin/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    // Exchange code for token
    const tokenResponse = await axios.post(
      LINKEDIN_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        client_id: process.env.LINKEDIN_CLIENT_ID || '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI || '',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // Get user profile
    const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const profile = profileResponse.data;
    const displayName = `${profile.localizedFirstName} ${profile.localizedLastName}`;

    // LinkedIn Live uses RTMP but requires setting up via LinkedIn API
    // Store destination with access token for later live video creation
    await prisma.destination.create({
      data: {
        userId,
        platform: 'linkedin',
        name: displayName,
        rtmpUrl: '', // Will be provided when creating live video
        streamKey: encrypt(''), // Will be provided when creating live video
        accessToken: encrypt(access_token),
        refreshToken: null,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        isEnabled: true,
      },
    });

    logger.info(`LinkedIn OAuth completed for user ${userId}`);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=destinations&success=linkedin`);
  } catch (error: any) {
    logger.error('LinkedIn OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings?tab=destinations&error=linkedin`);
  }
});

/**
 * Disconnect OAuth
 */
router.delete('/disconnect/:destinationId', authenticate, async (req, res) => {
  try {
    const { destinationId } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const destination = await prisma.destination.findFirst({
      where: { id: destinationId, userId },
    });

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Delete destination
    await prisma.destination.delete({
      where: { id: destinationId },
    });

    logger.info(`OAuth disconnected: ${destination.platform} for user ${userId}`);
    res.json({ message: 'Disconnected successfully' });
  } catch (error) {
    logger.error('OAuth disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export default router;
