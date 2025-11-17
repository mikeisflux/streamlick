import { Router } from 'express';
import prisma from '../database/prisma';
import { authenticate, AuthRequest } from '../auth/middleware';
import { encrypt, decrypt } from '../utils/crypto';
import logger from '../utils/logger';

const router = Router();

// Admin middleware - check if user is admin
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true },
    });

    if (user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    logger.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Apply authentication and admin check to all routes
router.use(authenticate, requireAdmin);

// Get all system settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      select: {
        id: true,
        category: true,
        key: true,
        value: true,
        isEncrypted: true,
        description: true,
        updatedAt: true,
      },
    });

    // Decrypt sensitive values for admin viewing
    const decryptedSettings = settings.map((setting: any) => {
      let value = setting.value;
      if (setting.isEncrypted) {
        try {
          value = decrypt(setting.value);
        } catch (decryptError) {
          logger.warn(`Failed to decrypt setting ${setting.key}:`, decryptError);
          value = '';
        }
      }
      return {
        ...setting,
        value,
      };
    });

    res.json(decryptedSettings);
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get settings by category
router.get('/settings/:category', async (req, res) => {
  try {
    const { category } = req.params;

    const settings = await prisma.systemSetting.findMany({
      where: { category },
      select: {
        id: true,
        category: true,
        key: true,
        value: true,
        isEncrypted: true,
        description: true,
        updatedAt: true,
      },
    });

    const decryptedSettings = settings.map((setting: any) => {
      let value = setting.value;
      if (setting.isEncrypted) {
        try {
          value = decrypt(setting.value);
        } catch (decryptError) {
          logger.warn(`Failed to decrypt setting ${setting.key}:`, decryptError);
          value = '';
        }
      }
      return {
        ...setting,
        value,
      };
    });

    res.json(decryptedSettings);
  } catch (error) {
    logger.error('Get category settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update or create a setting
router.post('/settings', async (req, res) => {
  try {
    const { category, key, value, isEncrypted, description } = req.body;

    if (!category || !key || value === undefined) {
      return res.status(400).json({ error: 'Category, key, and value are required' });
    }

    const encryptedValue = isEncrypted ? encrypt(value) : value;

    const setting = await prisma.systemSetting.upsert({
      where: {
        category_key: {
          category,
          key,
        },
      },
      update: {
        value: encryptedValue,
        isEncrypted: isEncrypted || false,
        description: description || null,
      },
      create: {
        category,
        key,
        value: encryptedValue,
        isEncrypted: isEncrypted || false,
        description: description || null,
      },
    });

    res.json({
      ...setting,
      value: isEncrypted ? decrypt(setting.value) : setting.value,
    });
  } catch (error) {
    logger.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// Delete a setting
router.delete('/settings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.systemSetting.delete({
      where: { id },
    });

    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    logger.error('Delete setting error:', error);
    res.status(500).json({ error: 'Failed to delete setting' });
  }
});

// Get platform OAuth credentials
router.get('/oauth-config', async (req, res) => {
  try {
    const oauthSettings = await prisma.systemSetting.findMany({
      where: {
        category: 'oauth',
      },
    });

    // Group by platform
    const platforms = ['youtube', 'facebook', 'twitch', 'twitter', 'x', 'rumble', 'linkedin'];
    const config: any = {};

    platforms.forEach(platform => {
      config[platform] = {
        clientId: '',
        clientSecret: '',
        redirectUri: '',
        enabled: false,
      };
    });

    oauthSettings.forEach((setting: any) => {
      const match = setting.key.match(/^(\w+)_(client_id|client_secret|redirect_uri|enabled)$/);
      if (match) {
        const [, platform, field] = match;
        if (config[platform]) {
          let value = setting.value;
          if (setting.isEncrypted) {
            try {
              value = decrypt(setting.value);
            } catch (decryptError) {
              logger.warn(`Failed to decrypt OAuth setting ${setting.key}:`, decryptError);
              value = '';
            }
          }

          if (field === 'client_id') {
            config[platform].clientId = value;
          } else if (field === 'client_secret') {
            config[platform].clientSecret = value;
          } else if (field === 'redirect_uri') {
            config[platform].redirectUri = value;
          } else if (field === 'enabled') {
            config[platform].enabled = value === 'true';
          }
        }
      }
    });

    res.json(config);
  } catch (error) {
    logger.error('Get OAuth config error:', error);
    res.status(500).json({ error: 'Failed to fetch OAuth configuration' });
  }
});

// Update platform OAuth credentials
router.post('/oauth-config/:platform', async (req, res) => {
  try {
    const { platform } = req.params;
    const { clientId, clientSecret, enabled, redirectUri } = req.body;

    const updates: any[] = [];

    if (clientId !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: {
            category_key: {
              category: 'oauth',
              key: `${platform}_client_id`,
            },
          },
          update: {
            value: encrypt(clientId),
            isEncrypted: true,
          },
          create: {
            category: 'oauth',
            key: `${platform}_client_id`,
            value: encrypt(clientId),
            isEncrypted: true,
            description: `${platform} OAuth Client ID`,
          },
        })
      );
    }

    if (clientSecret !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: {
            category_key: {
              category: 'oauth',
              key: `${platform}_client_secret`,
            },
          },
          update: {
            value: encrypt(clientSecret),
            isEncrypted: true,
          },
          create: {
            category: 'oauth',
            key: `${platform}_client_secret`,
            value: encrypt(clientSecret),
            isEncrypted: true,
            description: `${platform} OAuth Client Secret`,
          },
        })
      );
    }

    if (redirectUri !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: {
            category_key: {
              category: 'oauth',
              key: `${platform}_redirect_uri`,
            },
          },
          update: {
            value: encrypt(redirectUri),
            isEncrypted: true,
          },
          create: {
            category: 'oauth',
            key: `${platform}_redirect_uri`,
            value: encrypt(redirectUri),
            isEncrypted: true,
            description: `${platform} OAuth Redirect URI`,
          },
        })
      );
    }

    if (enabled !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: {
            category_key: {
              category: 'oauth',
              key: `${platform}_enabled`,
            },
          },
          update: {
            value: enabled.toString(),
            isEncrypted: false,
          },
          create: {
            category: 'oauth',
            key: `${platform}_enabled`,
            value: enabled.toString(),
            isEncrypted: false,
            description: `Enable ${platform} OAuth`,
          },
        })
      );
    }

    await Promise.all(updates);

    res.json({ message: 'OAuth configuration updated successfully' });
  } catch (error) {
    logger.error('Update OAuth config error:', error);
    res.status(500).json({ error: 'Failed to update OAuth configuration' });
  }
});

// Get webhook configuration
router.get('/webhooks', async (req, res) => {
  try {
    const webhooks = await prisma.systemSetting.findMany({
      where: { category: 'webhook' },
    });

    const config = webhooks.map((webhook: any) => {
      let value = webhook.value;
      if (webhook.isEncrypted) {
        try {
          value = decrypt(webhook.value);
        } catch (decryptError) {
          logger.warn(`Failed to decrypt webhook ${webhook.key}:`, decryptError);
          value = '';
        }
      }
      return {
        id: webhook.id,
        key: webhook.key,
        value,
        description: webhook.description,
      };
    });

    res.json(config);
  } catch (error) {
    logger.error('Get webhooks error:', error);
    res.status(500).json({ error: 'Failed to fetch webhook configuration' });
  }
});

// Get system configuration
router.get('/system-config', async (req, res) => {
  try {
    const systemConfig = await prisma.systemSetting.findMany({
      where: { category: 'system' },
    });

    const config: any = {};

    systemConfig.forEach((setting: any) => {
      if (setting.isEncrypted) {
        try {
          config[setting.key] = decrypt(setting.value);
        } catch (decryptError) {
          // If decryption fails (wrong key, corrupted data, etc), return empty string
          logger.warn(`Failed to decrypt setting ${setting.key}:`, decryptError);
          config[setting.key] = '';
        }
      } else {
        config[setting.key] = setting.value;
      }
    });

    res.json(config);
  } catch (error) {
    logger.error('Get system config error:', error);
    res.status(500).json({ error: 'Failed to fetch system configuration' });
  }
});

// Update system configuration
router.post('/system-config', async (req, res) => {
  try {
    const updates: any[] = [];

    for (const [key, value] of Object.entries(req.body)) {
      // Skip undefined, null, or empty string values to avoid overwriting existing settings
      if (value === undefined || value === null || value === '') {
        continue;
      }

      const isEncrypted = key.includes('secret') || key.includes('key') || key.includes('password');

      updates.push(
        prisma.systemSetting.upsert({
          where: {
            category_key: {
              category: 'system',
              key,
            },
          },
          update: {
            value: isEncrypted ? encrypt(value as string) : (value as string),
            isEncrypted,
          },
          create: {
            category: 'system',
            key,
            value: isEncrypted ? encrypt(value as string) : (value as string),
            isEncrypted,
            description: `System setting: ${key}`,
          },
        })
      );
    }

    await Promise.all(updates);

    res.json({ message: 'System configuration updated successfully' });
  } catch (error) {
    logger.error('Update system config error:', error);
    res.status(500).json({ error: 'Failed to update system configuration' });
  }
});

// Get storage statistics
router.get('/storage-stats', async (req, res) => {
  try {
    // Get R2 credentials from system settings
    const r2Settings = await prisma.systemSetting.findMany({
      where: {
        category: 'system',
        key: {
          in: ['r2_account_id', 'r2_access_key_id', 'r2_secret_access_key', 'r2_bucket_name'],
        },
      },
    });

    const r2Config: any = {};
    r2Settings.forEach((setting: any) => {
      r2Config[setting.key] = setting.isEncrypted ? decrypt(setting.value) : setting.value;
    });

    // Check if R2 is configured
    if (!r2Config.r2_access_key_id || !r2Config.r2_secret_access_key || !r2Config.r2_bucket_name || !r2Config.r2_account_id) {
      return res.json({
        configured: false,
        totalSize: 0,
        objectCount: 0,
        bucketName: '',
      });
    }

    // Use AWS SDK to connect to R2
    const AWS = require('aws-sdk');

    const s3 = new AWS.S3({
      endpoint: `https://${r2Config.r2_account_id}.r2.cloudflarestorage.com`,
      accessKeyId: r2Config.r2_access_key_id,
      secretAccessKey: r2Config.r2_secret_access_key,
      signatureVersion: 'v4',
      region: 'auto',
    });

    // List objects to get statistics
    let totalSize = 0;
    let objectCount = 0;
    let continuationToken: string | undefined = undefined;

    try {
      // Paginate through all objects
      do {
        const response: any = await s3.listObjectsV2({
          Bucket: r2Config.r2_bucket_name,
          ContinuationToken: continuationToken,
        }).promise();

        objectCount += response.KeyCount || 0;

        if (response.Contents) {
          response.Contents.forEach((obj: any) => {
            totalSize += obj.Size || 0;
          });
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      res.json({
        configured: true,
        totalSize,
        objectCount,
        bucketName: r2Config.r2_bucket_name,
        formattedSize: formatBytes(totalSize),
      });
    } catch (error: any) {
      logger.error('R2 stats error:', error);
      res.json({
        configured: true,
        error: 'Failed to fetch R2 statistics',
        totalSize: 0,
        objectCount: 0,
        bucketName: r2Config.r2_bucket_name,
      });
    }
  } catch (error) {
    logger.error('Get storage stats error:', error);
    res.status(500).json({ error: 'Failed to fetch storage statistics' });
  }
});

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;
