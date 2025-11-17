import { Router } from 'express';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../auth/middleware';
import { encrypt, decrypt } from '../utils/crypto';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * Get OAuth credentials from database (admin settings) or environment variables
 */
async function getOAuthCredentials(platform: string): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}> {
  try {
    // Try to get from database first
    const settings = await prisma.systemSetting.findMany({
      where: {
        category: 'oauth',
        key: {
          in: [
            `${platform}_client_id`,
            `${platform}_client_secret`,
            `${platform}_redirect_uri`,
          ],
        },
      },
    });

    logger.info(`[OAuth] Retrieved ${settings.length} settings for ${platform}:`,
      settings.map(s => ({ key: s.key, hasValue: !!s.value, isEncrypted: s.isEncrypted })));

    const dbClientId = settings.find(s => s.key === `${platform}_client_id`)?.value;
    const dbClientSecret = settings.find(s => s.key === `${platform}_client_secret`)?.value;
    const dbRedirectUri = settings.find(s => s.key === `${platform}_redirect_uri`)?.value;

    logger.info(`[OAuth] Raw database values for ${platform}:`, {
      clientId: dbClientId ? `${dbClientId.substring(0, 10)}...` : 'missing',
      clientSecret: dbClientSecret ? 'present' : 'missing',
      redirectUri: dbRedirectUri ? dbRedirectUri.substring(0, 30) : 'missing'
    });

    // Decrypt all encrypted values
    let clientId = dbClientId;
    let clientSecret = dbClientSecret;
    let redirectUri = dbRedirectUri;

    if (clientId) {
      try {
        clientId = decrypt(clientId);
        logger.info(`[OAuth] Successfully decrypted clientId for ${platform}`);
      } catch (err) {
        logger.warn(`[OAuth] Failed to decrypt clientId for ${platform}, using as-is:`, err);
      }
    }

    if (clientSecret) {
      try {
        clientSecret = decrypt(clientSecret);
        logger.info(`[OAuth] Successfully decrypted clientSecret for ${platform}`);
      } catch (err) {
        logger.warn(`[OAuth] Failed to decrypt clientSecret for ${platform}, using as-is:`, err);
      }
    }

    if (redirectUri) {
      try {
        redirectUri = decrypt(redirectUri);
        logger.info(`[OAuth] Successfully decrypted redirectUri for ${platform}: ${redirectUri}`);
      } catch (err) {
        logger.warn(`[OAuth] Failed to decrypt redirectUri for ${platform}, using as-is:`, err);
      }
    }

    // Use database values if available, otherwise fall back to environment variables
    const envPrefix = platform.toUpperCase();
    const finalCreds = {
      clientId: clientId || process.env[`${envPrefix}_CLIENT_ID`] || '',
      clientSecret: clientSecret || process.env[`${envPrefix}_CLIENT_SECRET`] || '',
      redirectUri: redirectUri || process.env[`${envPrefix}_REDIRECT_URI`] || '',
    };

    logger.info(`[OAuth] Final credentials for ${platform}:`, {
      clientId: finalCreds.clientId ? `${finalCreds.clientId.substring(0, 10)}...` : 'MISSING',
      clientSecret: finalCreds.clientSecret ? 'present' : 'MISSING',
      redirectUri: finalCreds.redirectUri || 'MISSING'
    });

    return finalCreds;
  } catch (error) {
    logger.error(`Error getting OAuth credentials for ${platform}:`, error);
    // Fall back to environment variables
    const envPrefix = platform.toUpperCase();
    return {
      clientId: process.env[`${envPrefix}_CLIENT_ID`] || '',
      clientSecret: process.env[`${envPrefix}_CLIENT_SECRET`] || '',
      redirectUri: process.env[`${envPrefix}_REDIRECT_URI`] || '',
    };
  }
}

// OAuth URLs
const YOUTUBE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
].join(' ');

const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v24.0/dialog/oauth';
const FACEBOOK_TOKEN_URL = 'https://graph.facebook.com/v24.0/oauth/access_token';
// Facebook scopes - Using minimal auto-approved scopes
// Additional scopes (publish_video, pages_manage_posts) require Facebook app review
const FACEBOOK_SCOPES = [
  'pages_show_list',               // Required for listing user's pages (auto-approved)
  'pages_read_engagement',         // Required for reading page data (auto-approved)
  'pages_read_user_content',       // For reading comments on live videos (usually auto-approved)
  'publish_video',                 // Required for creating live videos (REQUIRES app review)
  'pages_manage_posts',            // For managing posts and comments (REQUIRES app review)
  'read_insights',                 // For analytics and viewer stats (may require app review)
].join(',');

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
router.get('/youtube/authorize', authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const state = Buffer.from(JSON.stringify({ userId, platform: 'youtube' })).toString('base64');

    logger.info(`[OAuth] YouTube authorize request from user ${userId}`);
    const credentials = await getOAuthCredentials('youtube');

    logger.info(`[OAuth] Checking YouTube credentials - clientId: ${!!credentials.clientId}, redirectUri: ${!!credentials.redirectUri}`);

    if (!credentials.clientId || !credentials.redirectUri) {
      logger.error(`[OAuth] YouTube OAuth validation failed - clientId: ${credentials.clientId ? 'present' : 'MISSING'}, redirectUri: ${credentials.redirectUri || 'MISSING'}`);
      return res.status(400).json({
        error: 'YouTube OAuth not configured. Please configure in Admin Settings.'
      });
    }

    logger.info(`[OAuth] YouTube credentials validated successfully`);

    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: credentials.redirectUri,
      response_type: 'code',
      scope: YOUTUBE_SCOPES,
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    const authUrl = `${YOUTUBE_AUTH_URL}?${params.toString()}`;
    res.json({ url: authUrl });
  } catch (error) {
    logger.error('YouTube authorize error:', error);
    res.status(500).json({ error: 'Failed to initialize YouTube OAuth' });
  }
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

    const credentials = await getOAuthCredentials('youtube');

    // Exchange code for tokens
    const tokenResponse = await axios.post(YOUTUBE_TOKEN_URL, {
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: credentials.redirectUri,
      grant_type: 'authorization_code',
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Calculate token expiration (expires_in is in seconds, default 1 hour)
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 3600) * 1000);

    // Get YouTube channel info
    const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet,id', mine: true },
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const channel = channelResponse.data.items?.[0];
    if (!channel) {
      return res.status(400).json({ error: 'No YouTube channel found' });
    }

    // Store destination
    // Note: Live stream RTMP URLs are created dynamically when broadcast starts
    await prisma.destination.create({
      data: {
        userId,
        platform: 'youtube',
        platformUserId: channel.id,
        displayName: channel.snippet.title,
        channelId: channel.id,
        rtmpUrl: null, // Will be set when creating live broadcast
        streamKey: null, // Will be set when creating live broadcast
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
        tokenExpiresAt,
      },
    });

    logger.info(`YouTube OAuth completed for user ${userId}`);

    // Redirect to settings page
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?success=youtube`);
  } catch (error) {
    logger.error('YouTube OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=youtube`);
  }
});

/**
 * Facebook OAuth Flow
 */

// Step 1: Initiate Facebook OAuth
router.get('/facebook/authorize', authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const state = Buffer.from(JSON.stringify({ userId, platform: 'facebook' })).toString('base64');

    logger.info(`[OAuth] Facebook authorize request from user ${userId}`);
    const credentials = await getOAuthCredentials('facebook');

    if (!credentials.clientId || !credentials.redirectUri) {
      logger.error('[OAuth] Facebook OAuth not configured');
      return res.status(400).json({
        error: 'Facebook OAuth not configured. Please configure in Admin Settings.'
      });
    }

    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: credentials.redirectUri,
      state,
      scope: FACEBOOK_SCOPES,
    });

    const authUrl = `${FACEBOOK_AUTH_URL}?${params.toString()}`;
    logger.info('[OAuth] Facebook auth URL generated:', {
      redirectUri: credentials.redirectUri,
      scopes: FACEBOOK_SCOPES,
      authUrlLength: authUrl.length
    });
    res.json({ url: authUrl });
  } catch (error) {
    logger.error('Facebook authorize error:', error);
    res.status(500).json({ error: 'Failed to initialize Facebook OAuth' });
  }
});

// Step 2: Facebook OAuth Callback
router.get('/facebook/callback', async (req, res) => {
  try {
    // Log all query parameters to debug
    logger.info('[OAuth] Facebook callback received with query params:', req.query);

    const { code, state, error, error_reason, error_description } = req.query;

    // Check if Facebook returned an error
    if (error) {
      logger.error('[OAuth] Facebook returned error:', { error, error_reason, error_description });
      return res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=facebook&reason=${error_reason || error}`);
    }

    if (!code || !state) {
      logger.error('[OAuth] Missing code or state in callback. Query params:', req.query);
      return res.status(400).json({ error: 'Missing code or state', receivedParams: Object.keys(req.query) });
    }

    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    const credentials = await getOAuthCredentials('facebook');

    // Step 1: Exchange code for short-lived token
    const tokenResponse = await axios.get(FACEBOOK_TOKEN_URL, {
      params: {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: credentials.redirectUri,
        code,
      },
    });

    const { access_token: shortLivedToken } = tokenResponse.data;

    // Step 2: Exchange short-lived token for long-lived token (~60 days)
    const longLivedResponse = await axios.get('https://graph.facebook.com/v24.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        fb_exchange_token: shortLivedToken,
      },
    });

    const { access_token: longLivedToken, expires_in } = longLivedResponse.data;

    // Calculate token expiration date (expires_in is in seconds, default 60 days)
    const tokenExpiresAt = new Date(Date.now() + (expires_in || 5184000) * 1000); // 5184000 = 60 days in seconds

    // Get user's pages
    const pagesResponse = await axios.get('https://graph.facebook.com/v24.0/me/accounts', {
      params: { access_token: longLivedToken },
    });

    const page = pagesResponse.data.data?.[0];
    if (!page) {
      return res.status(400).json({ error: 'No Facebook page found' });
    }

    // Get page access token (short-lived)
    const pageShortToken = page.access_token;

    // Exchange page token for long-lived token
    const pageLongLivedResponse = await axios.get('https://graph.facebook.com/v24.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        fb_exchange_token: pageShortToken,
      },
    });

    const { access_token: pageLongLivedToken, expires_in: pageExpiresIn } = pageLongLivedResponse.data;
    const pageTokenExpiresAt = new Date(Date.now() + (pageExpiresIn || 5184000) * 1000);

    // Store destination
    // Note: Live video RTMP URLs are created dynamically when broadcast starts
    await prisma.destination.create({
      data: {
        userId,
        platform: 'facebook',
        platformUserId: page.id,
        displayName: page.name,
        pageId: page.id,
        rtmpUrl: null, // Will be set when creating live video
        streamKey: null, // Will be set when creating live video
        accessToken: encrypt(pageLongLivedToken),
        refreshToken: null,
        tokenExpiresAt: pageTokenExpiresAt,
      },
    });

    logger.info(`Facebook OAuth completed for user ${userId}`);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?success=facebook`);
  } catch (error) {
    logger.error('Facebook OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=facebook`);
  }
});

/**
 * Twitch OAuth Flow
 */

// Step 1: Initiate Twitch OAuth
router.get('/twitch/authorize', authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const state = Buffer.from(JSON.stringify({ userId, platform: 'twitch' })).toString('base64');

    const credentials = await getOAuthCredentials('twitch');

    if (!credentials.clientId || !credentials.redirectUri) {
      return res.status(400).json({
        error: 'Twitch OAuth not configured. Please configure in Admin Settings.'
      });
    }

    const params = new URLSearchParams({
      client_id: credentials.clientId,
      redirect_uri: credentials.redirectUri,
      response_type: 'code',
      scope: TWITCH_SCOPES,
      state,
    });

    const authUrl = `${TWITCH_AUTH_URL}?${params.toString()}`;
    res.json({ url: authUrl });
  } catch (error) {
    logger.error('Twitch authorize error:', error);
    res.status(500).json({ error: 'Failed to initialize Twitch OAuth' });
  }
});

// Step 2: Twitch OAuth Callback
router.get('/twitch/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    const credentials = await getOAuthCredentials('twitch');

    // Exchange code for token
    const tokenResponse = await axios.post(TWITCH_TOKEN_URL, {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: credentials.redirectUri,
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Client-Id': credentials.clientId,
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
          'Client-Id': credentials.clientId,
        },
      }
    );

    const streamKey = streamKeyResponse.data.data?.[0]?.stream_key || '';

    // Store destination
    await prisma.destination.create({
      data: {
        userId,
        platform: 'twitch',
        displayName: twitchUser.display_name,
        rtmpUrl: `rtmp://live.twitch.tv/app`,
        streamKey: encrypt(streamKey),
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
      },
    });

    logger.info(`Twitch OAuth completed for user ${userId}`);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?success=twitch`);
  } catch (error) {
    logger.error('Twitch OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=twitch`);
  }
});

/**
 * X (Twitter) OAuth Flow
 */

// Step 1: Initiate X OAuth
router.get('/x/authorize', authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const state = Buffer.from(JSON.stringify({ userId, platform: 'x' })).toString('base64');

    const credentials = await getOAuthCredentials('x');

    if (!credentials.clientId || !credentials.redirectUri) {
      return res.status(400).json({
        error: 'X/Twitter OAuth not configured. Please configure in Admin Settings.'
      });
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = Buffer.from(Math.random().toString()).toString('base64').substring(0, 128);
    const codeChallenge = Buffer.from(codeVerifier).toString('base64url');

    // Store code verifier in session/cache (in production, use Redis)
    // For now, we'll include it in state (not secure for production)

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: credentials.clientId,
      redirect_uri: credentials.redirectUri,
      scope: X_SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${X_AUTH_URL}?${params.toString()}`;
    res.json({ url: authUrl });
  } catch (error) {
    logger.error('X authorize error:', error);
    res.status(500).json({ error: 'Failed to initialize X OAuth' });
  }
});

// Step 2: X OAuth Callback
router.get('/x/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    const credentials = await getOAuthCredentials('x');

    // Exchange code for token (with PKCE)
    const tokenResponse = await axios.post(
      X_TOKEN_URL,
      {
        code,
        grant_type: 'authorization_code',
        client_id: credentials.clientId,
        redirect_uri: credentials.redirectUri,
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
        displayName: `@${xUser.username}`,
        rtmpUrl: 'rtmp://fa.contribute.live-video.net/app', // X/Twitter Media Studio RTMP
        streamKey: encrypt(''), // User must get from Media Studio
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : null,
      },
    });

    logger.info(`X OAuth completed for user ${userId}`);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?success=x`);
  } catch (error) {
    logger.error('X OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=x`);
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
    const userId = req.user!.userId;
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
        displayName: userData.username || 'Rumble',
        rtmpUrl,
        streamKey: encrypt(streamKey),
        accessToken: encrypt(apiKey), // Store API key as access token
        refreshToken: null,
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
router.get('/linkedin/authorize', authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const state = Buffer.from(JSON.stringify({ userId, platform: 'linkedin' })).toString('base64');

    const credentials = await getOAuthCredentials('linkedin');

    if (!credentials.clientId || !credentials.redirectUri) {
      return res.status(400).json({
        error: 'LinkedIn OAuth not configured. Please configure in Admin Settings.'
      });
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: credentials.clientId,
      redirect_uri: credentials.redirectUri,
      state,
      scope: LINKEDIN_SCOPES,
    });

    const authUrl = `${LINKEDIN_AUTH_URL}?${params.toString()}`;
    res.json({ url: authUrl });
  } catch (error) {
    logger.error('LinkedIn authorize error:', error);
    res.status(500).json({ error: 'Failed to initialize LinkedIn OAuth' });
  }
});

// Step 2: LinkedIn OAuth Callback
router.get('/linkedin/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const { userId } = JSON.parse(Buffer.from(state as string, 'base64').toString());

    const credentials = await getOAuthCredentials('linkedin');

    // Exchange code for token
    const tokenResponse = await axios.post(
      LINKEDIN_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: credentials.redirectUri,
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
        displayName: displayName,
        rtmpUrl: '', // Will be provided when creating live video
        streamKey: encrypt(''), // Will be provided when creating live video
        accessToken: encrypt(access_token),
        refreshToken: null,
      },
    });

    logger.info(`LinkedIn OAuth completed for user ${userId}`);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?success=linkedin`);
  } catch (error: any) {
    logger.error('LinkedIn OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=linkedin`);
  }
});

/**
 * Rumble API Key Setup
 * Rumble uses API key authentication instead of OAuth
 */
router.post('/rumble/setup', authenticate, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { apiKey, channelUrl } = req.body;

    if (!apiKey || !channelUrl) {
      return res.status(400).json({ error: 'API key and channel URL are required' });
    }

    logger.info(`[Rumble] Setup request from user ${userId}`);

    // Import Rumble service functions
    const { validateRumbleApiKey, getRumbleChannelInfo } = await import('../services/rumble.service');

    // Validate API key
    const isValid = await validateRumbleApiKey(apiKey);
    if (!isValid) {
      logger.warn(`[Rumble] Invalid API key for user ${userId}`);
      return res.status(400).json({ error: 'Invalid Rumble API key. Please check your key and try again.' });
    }

    // Get channel info
    let channelInfo;
    try {
      channelInfo = await getRumbleChannelInfo(apiKey);
    } catch (error: any) {
      logger.error(`[Rumble] Failed to get channel info for user ${userId}:`, error.message);
      // Continue anyway, use provided channel URL
      channelInfo = {
        channelId: 'unknown',
        channelName: channelUrl.split('/').pop() || 'Rumble Channel',
        channelUrl: channelUrl,
      };
    }

    // Check if Rumble destination already exists for this user
    const existingDestination = await prisma.destination.findFirst({
      where: {
        userId,
        platform: 'rumble',
      },
    });

    if (existingDestination) {
      // Update existing destination
      await prisma.destination.update({
        where: { id: existingDestination.id },
        data: {
          displayName: channelInfo.channelName,
          accessToken: encrypt(apiKey),
          rtmpUrl: '', // Will be set when creating live stream
          streamKey: encrypt(''), // Will be set when creating live stream
          isActive: true,
        },
      });

      logger.info(`[Rumble] Updated destination for user ${userId}: ${channelInfo.channelName}`);
    } else {
      // Create new destination
      await prisma.destination.create({
        data: {
          userId,
          platform: 'rumble',
          displayName: channelInfo.channelName,
          accessToken: encrypt(apiKey),
          refreshToken: null,
          rtmpUrl: '', // Will be set when creating live stream
          streamKey: encrypt(''), // Will be set when creating live stream
          isActive: true,
        },
      });

      logger.info(`[Rumble] Created new destination for user ${userId}: ${channelInfo.channelName}`);
    }

    res.json({
      message: 'Rumble connected successfully',
      channelName: channelInfo.channelName,
      channelUrl: channelInfo.channelUrl,
    });
  } catch (error: any) {
    logger.error('[Rumble] Setup error:', error);
    res.status(500).json({
      error: 'Failed to connect to Rumble. Please try again.',
      details: error.message,
    });
  }
});

/**
 * Disconnect OAuth
 */
router.delete('/disconnect/:destinationId', authenticate, async (req, res) => {
  try {
    const { destinationId } = req.params;
    const userId = req.user!.userId;

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
