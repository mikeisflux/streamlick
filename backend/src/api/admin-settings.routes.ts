import { Router } from 'express';
import prisma from '../database/prisma';
import { authenticate, AuthRequest } from '../auth/middleware';
import { encrypt, decrypt } from '../utils/encryption';
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
    const decryptedSettings = settings.map(setting => ({
      ...setting,
      value: setting.isEncrypted ? decrypt(setting.value) : setting.value,
    }));

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

    const decryptedSettings = settings.map(setting => ({
      ...setting,
      value: setting.isEncrypted ? decrypt(setting.value) : setting.value,
    }));

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
    const platforms = ['youtube', 'facebook', 'twitch', 'twitter', 'rumble', 'linkedin'];
    const config: any = {};

    platforms.forEach(platform => {
      config[platform] = {
        clientId: '',
        clientSecret: '',
        enabled: false,
      };
    });

    oauthSettings.forEach(setting => {
      const match = setting.key.match(/^(\w+)_(client_id|client_secret|enabled)$/);
      if (match) {
        const [, platform, field] = match;
        if (config[platform]) {
          if (field === 'client_id') {
            config[platform].clientId = setting.isEncrypted ? decrypt(setting.value) : setting.value;
          } else if (field === 'client_secret') {
            config[platform].clientSecret = setting.isEncrypted ? decrypt(setting.value) : setting.value;
          } else if (field === 'enabled') {
            config[platform].enabled = setting.value === 'true';
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
    const { clientId, clientSecret, enabled } = req.body;

    const updates = [];

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

    const config = webhooks.map(webhook => ({
      id: webhook.id,
      key: webhook.key,
      value: webhook.isEncrypted ? decrypt(webhook.value) : webhook.value,
      description: webhook.description,
    }));

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

    systemConfig.forEach(setting => {
      config[setting.key] = setting.isEncrypted ? decrypt(setting.value) : setting.value;
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
    const updates = [];

    for (const [key, value] of Object.entries(req.body)) {
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

export default router;
