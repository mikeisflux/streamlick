import { Router } from 'express';
import axios from 'axios';
import { authenticate } from '../auth/middleware';
import { encrypt, decrypt, generateToken } from '../utils/crypto';
import logger from '../utils/logger';
import crypto from 'crypto';
import prisma from '../database/prisma';

const router = Router();

/**
 * Get OAuth credentials for a platform from database or environment variables
 * Handles decryption of encrypted credentials
 */
export async function getOAuthCredentials(platform: string): Promise<{
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

    const dbClientId = settings.find(s => s.key === `${platform}_client_id`)?.value;
    const dbClientSecret = settings.find(s => s.key === `${platform}_client_secret`)?.value;
    const dbRedirectUri = settings.find(s => s.key === `${platform}_redirect_uri`)?.value;

    // Decrypt all encrypted values
    let clientId = dbClientId;
    let clientSecret = dbClientSecret;
    let redirectUri = dbRedirectUri;

    if (clientId) {
      try {
        clientId = decrypt(clientId);
      } catch (err) {
        logger.warn(`[OAuth] Failed to decrypt clientId for ${platform}, using as-is:`, err);
      }
    }

    if (clientSecret) {
      try {
        clientSecret = decrypt(clientSecret);
      } catch (err) {
        logger.warn(`[OAuth] Failed to decrypt clientSecret for ${platform}, using as-is:`, err);
      }
    }

    if (redirectUri) {
      try {
        redirectUri = decrypt(redirectUri);
      } catch (err) {
        logger.warn(`[OAuth] Failed to decrypt redirectUri for ${platform}, using as-is:`, err);
      }
    }

    // Use database values if available, otherwise fall back to environment variables
    const envPrefix = platform.toUpperCase();
    return {
      clientId: clientId || process.env[`${envPrefix}_CLIENT_ID`] || '',
      clientSecret: clientSecret || process.env[`${envPrefix}_CLIENT_SECRET`] || '',
      redirectUri: redirectUri || process.env[`${envPrefix}_REDIRECT_URI`] || '',
    };
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

/**
 * CRITICAL FIX: OAuth CSRF Protection Functions
 * Prevents CSRF attacks by validating state tokens
 */

/**
 * Generate and store OAuth state token
 */
async function generateOAuthState(userId: string, platform: string): Promise<string> {
  // Generate cryptographically random state token (32 bytes = 64 hex chars)
  const state = generateToken(32);

  // Store in database with 10 minute expiration
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.oAuthState.create({
    data: {
      userId,
      platform,
      state,
      expiresAt,
    },
  });

  return state;
}

/**
 * Verify and consume OAuth state token (single-use)
 */
async function verifyOAuthState(state: string, platform: string): Promise<string | null> {
  try {
    // Find valid, non-expired state token
    const stateRecord = await prisma.oAuthState.findFirst({
      where: {
        state,
        platform,
        expiresAt: {
          gte: new Date(), // Not expired
        },
      },
    });

    if (!stateRecord) {
      logger.warn(`Invalid or expired OAuth state for ${platform}: ${state.substring(0, 10)}...`);
      return null;
    }

    // Delete token immediately (single-use)
    await prisma.oAuthState.delete({
      where: { id: stateRecord.id },
    });

    return stateRecord.userId;
  } catch (error) {
    logger.error('OAuth state verification error:', error);
    return null;
  }
}

/**
 * Cleanup expired OAuth state tokens (run periodically)
 */
async function cleanupExpiredOAuthStates(): Promise<number> {
  const result = await prisma.oAuthState.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}

// OAuth URLs
const YOUTUBE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
// CRITICAL FIX: Use full YouTube scope to create/manage live broadcasts
// youtube.readonly is READ ONLY - we need youtube or youtube.upload to create broadcasts
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube', // Full YouTube access (create/manage broadcasts)
  'https://www.googleapis.com/auth/youtube.force-ssl', // Required for live streaming
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

    // CRITICAL FIX: Generate cryptographically random state for CSRF protection
    const state = await generateOAuthState(userId, 'youtube');
    const credentials = await getOAuthCredentials('youtube');

    if (!credentials.clientId || !credentials.redirectUri) {
      return res.status(400).json({
        error: 'YouTube OAuth not configured. Please configure in Admin Settings.'
      });
    }

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

    // CRITICAL FIX: Verify state token to prevent CSRF attacks
    const userId = await verifyOAuthState(state as string, 'youtube');
    if (!userId) {
      logger.warn(`YouTube OAuth callback rejected: Invalid or expired state token`);
      return res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=youtube_csrf`);
    }

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
    // CRITICAL FIX: Generate cryptographically random state for CSRF protection
    const state = await generateOAuthState(userId, 'facebook');
    const credentials = await getOAuthCredentials('facebook');

    if (!credentials.clientId || !credentials.redirectUri) {
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
    res.json({ url: authUrl });
  } catch (error) {
    logger.error('Facebook authorize error:', error);
    res.status(500).json({ error: 'Failed to initialize Facebook OAuth' });
  }
});

// Step 2: Facebook OAuth Callback
router.get('/facebook/callback', async (req, res) => {
  try {
    const { code, state, error, error_reason, error_description } = req.query;

    // Check if Facebook returned an error
    if (error) {
      logger.error('[OAuth] Facebook returned error:', { error, error_reason, error_description });
      return res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=facebook&reason=${error_reason || error}`);
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    // CRITICAL FIX: Verify state token to prevent CSRF attacks
    const userId = await verifyOAuthState(state as string, 'facebook');
    if (!userId) {
      logger.warn(`Facebook OAuth callback rejected: Invalid or expired state token`);
      return res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=facebook_csrf`);
    }

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
    // CRITICAL FIX: Generate cryptographically random state for CSRF protection
    const state = await generateOAuthState(userId, 'twitch');

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

    // CRITICAL FIX: Verify state token to prevent CSRF attacks
    const userId = await verifyOAuthState(state as string, 'twitch');
    if (!userId) {
      logger.warn(`Twitch OAuth callback rejected: Invalid or expired state token`);
      return res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=twitch_csrf`);
    }

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
    // CRITICAL FIX: Generate cryptographically random state for CSRF protection
    const state = await generateOAuthState(userId, 'x');

    const credentials = await getOAuthCredentials('x');

    if (!credentials.clientId || !credentials.redirectUri) {
      return res.status(400).json({
        error: 'X/Twitter OAuth not configured. Please configure in Admin Settings.'
      });
    }

    // CRITICAL FIX: Generate cryptographically secure PKCE code verifier
    // Must be 43-128 characters from unreserved charset [A-Z][a-z][0-9]-._~
    const codeVerifier = crypto.randomBytes(32).toString('base64url'); // 43 chars

    // CRITICAL FIX: Compute SHA256 hash for code_challenge (not plain base64)
    const hash = crypto.createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = hash.toString('base64url');

    // CRITICAL FIX: Store code verifier securely in database
    // Store with 10-minute expiration (OAuth flows should complete quickly)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.oAuthPKCE.create({
      data: {
        userId,
        platform: 'x',
        codeVerifier: encrypt(codeVerifier), // Encrypt for security
        state,
        expiresAt,
      },
    });

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

    // CRITICAL FIX: Verify state token to prevent CSRF attacks
    const userId = await verifyOAuthState(state as string, 'x');
    if (!userId) {
      logger.warn(`X OAuth callback rejected: Invalid or expired state token`);
      return res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=x_csrf`);
    }

    // CRITICAL FIX: Retrieve stored PKCE code_verifier from database
    const pkceRecord = await prisma.oAuthPKCE.findFirst({
      where: {
        userId,
        platform: 'x',
        state: state as string,
        expiresAt: {
          gte: new Date(), // Not expired
        },
      },
    });

    if (!pkceRecord) {
      return res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=x&reason=pkce_expired`);
    }

    // Decrypt code_verifier
    const codeVerifier = decrypt(pkceRecord.codeVerifier);

    // Delete PKCE record (one-time use)
    await prisma.oAuthPKCE.delete({
      where: { id: pkceRecord.id },
    });

    const credentials = await getOAuthCredentials('x');

    // Exchange code for token (with PKCE)
    const tokenResponse = await axios.post(
      X_TOKEN_URL,
      {
        code,
        grant_type: 'authorization_code',
        client_id: credentials.clientId,
        redirect_uri: credentials.redirectUri,
        code_verifier: codeVerifier, // CRITICAL FIX: Use stored code_verifier
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
    // CRITICAL FIX: Generate cryptographically random state for CSRF protection
    const state = await generateOAuthState(userId, 'linkedin');

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

    // CRITICAL FIX: Verify state token to prevent CSRF attacks
    const userId = await verifyOAuthState(state as string, 'linkedin');
    if (!userId) {
      logger.warn(`LinkedIn OAuth callback rejected: Invalid or expired state token`);
      return res.redirect(`${process.env.FRONTEND_URL}/oauth-success?error=linkedin_csrf`);
    }

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

    // Import Rumble service functions
    const { validateRumbleApiKey, getRumbleChannelInfo } = await import('../services/rumble.service');

    // Validate API key
    const isValid = await validateRumbleApiKey(apiKey);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid Rumble API key. Please check your key and try again.' });
    }

    // Get channel info
    let channelInfo;
    try {
      channelInfo = await getRumbleChannelInfo(apiKey);
    } catch (error: any) {
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
 * Revokes tokens on the OAuth provider's side before deleting from database
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

    // Revoke OAuth token on provider's side to ensure fresh re-authorization
    if (destination.accessToken) {
      try {
        const accessToken = decrypt(destination.accessToken);

        // Revoke token based on platform
        if (destination.platform === 'youtube' || destination.platform === 'google') {
          // Google/YouTube revocation endpoint
          await axios.post('https://oauth2.googleapis.com/revoke', null, {
            params: { token: accessToken },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          });
        } else if (destination.platform === 'facebook') {
          // Facebook revocation endpoint
          await axios.delete(`https://graph.facebook.com/v24.0/me/permissions`, {
            params: { access_token: accessToken }
          });
        } else if (destination.platform === 'twitch') {
          // Twitch revocation endpoint
          const credentials = await getOAuthCredentials('twitch');
          await axios.post('https://id.twitch.tv/oauth2/revoke', null, {
            params: {
              client_id: credentials.clientId,
              token: accessToken
            }
          });
        } else if (destination.platform === 'x') {
          // X/Twitter revocation endpoint
          const credentials = await getOAuthCredentials('x');
          await axios.post('https://api.twitter.com/2/oauth2/revoke', {
            token: accessToken,
            client_id: credentials.clientId
          }, {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        // LinkedIn and Rumble don't have standard revocation endpoints
      } catch (revokeError: any) {
        // Log but don't fail the disconnect - token might already be invalid
        logger.warn(`Failed to revoke ${destination.platform} token (continuing anyway):`, revokeError.message);
      }
    }

    // Delete destination from database
    await prisma.destination.delete({
      where: { id: destinationId },
    });

    res.json({ message: 'Disconnected successfully' });
  } catch (error) {
    logger.error('OAuth disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export default router;
