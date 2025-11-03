import request from 'supertest';
import express from 'express';
import destinationsRouter from '../../api/destinations.routes';
import prisma from '../../database/prisma';
import { generateAccessToken } from '../../auth/jwt';
import { encrypt, decrypt } from '../../utils/encryption';

const app = express();
app.use(express.json());
app.use('/api/destinations', destinationsRouter);

describe('Destinations API', () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    testUser = await prisma.user.create({
      data: {
        email: 'streamer@example.com',
        name: 'Test Streamer',
        planType: 'core',
      },
    });

    authToken = generateAccessToken({
      userId: testUser.id,
      email: testUser.email,
    });
  });

  describe('POST /api/destinations', () => {
    it('should create YouTube destination', async () => {
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'youtube',
          displayName: 'My YouTube Channel',
          rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
          streamKey: 'test-stream-key-123',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        platform: 'youtube',
        displayName: 'My YouTube Channel',
        userId: testUser.id,
        isActive: true,
      });

      expect(response.body).toHaveProperty('id');
      expect(response.body).not.toHaveProperty('streamKey'); // Should be encrypted and not returned

      // Verify encryption in database
      const destination = await prisma.destination.findUnique({
        where: { id: response.body.id },
      });
      expect(destination?.streamKey).not.toBe('test-stream-key-123');
      expect(decrypt(destination?.streamKey || '')).toBe('test-stream-key-123');
    });

    it('should create custom RTMP destination', async () => {
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'custom_rtmp',
          displayName: 'Restream.io',
          rtmpUrl: 'rtmp://live.restream.io/live',
          streamKey: 'restream-key-456',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        platform: 'custom_rtmp',
        displayName: 'Restream.io',
      });
    });

    it('should reject destination without platform', async () => {
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          displayName: 'Missing Platform',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject destination without RTMP credentials', async () => {
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'youtube',
          displayName: 'Incomplete Setup',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should enforce plan limits on destination count', async () => {
      // Free plan allows 1 destination
      const freeUser = await prisma.user.create({
        data: {
          email: 'freeuser@example.com',
          planType: 'free',
        },
      });

      const freeToken = generateAccessToken({
        userId: freeUser.id,
        email: freeUser.email,
      });

      // Create first destination (should succeed)
      await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${freeToken}`)
        .send({
          platform: 'youtube',
          displayName: 'First Destination',
          rtmpUrl: 'rtmp://youtube.com/live',
          streamKey: 'key1',
        })
        .expect(201);

      // Try to create second destination (should fail)
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${freeToken}`)
        .send({
          platform: 'facebook',
          displayName: 'Second Destination',
          rtmpUrl: 'rtmp://facebook.com/live',
          streamKey: 'key2',
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('plan limit');
    });
  });

  describe('GET /api/destinations', () => {
    beforeEach(async () => {
      // Create test destinations
      await prisma.destination.createMany({
        data: [
          {
            userId: testUser.id,
            platform: 'youtube',
            displayName: 'YouTube Main',
            rtmpUrl: 'rtmp://youtube.com/live',
            streamKey: encrypt('yt-key'),
            isActive: true,
          },
          {
            userId: testUser.id,
            platform: 'facebook',
            displayName: 'Facebook Page',
            rtmpUrl: 'rtmp://facebook.com/live',
            streamKey: encrypt('fb-key'),
            isActive: true,
          },
          {
            userId: testUser.id,
            platform: 'twitch',
            displayName: 'Twitch Channel',
            rtmpUrl: 'rtmp://twitch.tv/live',
            streamKey: encrypt('twitch-key'),
            isActive: false, // Inactive
          },
        ],
      });
    });

    it('should list all user destinations', async () => {
      const response = await request(app)
        .get('/api/destinations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toHaveProperty('platform');
      expect(response.body[0]).toHaveProperty('displayName');
      expect(response.body[0]).not.toHaveProperty('streamKey'); // Should not expose keys
    });

    it('should filter active destinations only', async () => {
      const response = await request(app)
        .get('/api/destinations?active=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((d: any) => d.isActive)).toBe(true);
    });

    it('should not show other users destinations', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          planType: 'free',
        },
      });

      await prisma.destination.create({
        data: {
          userId: otherUser.id,
          platform: 'youtube',
          displayName: 'Other User Channel',
          rtmpUrl: 'rtmp://youtube.com/live',
          streamKey: encrypt('other-key'),
        },
      });

      const response = await request(app)
        .get('/api/destinations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.every((d: any) => d.userId === testUser.id)).toBe(true);
    });
  });

  describe('PATCH /api/destinations/:id', () => {
    let destination: any;

    beforeEach(async () => {
      destination = await prisma.destination.create({
        data: {
          userId: testUser.id,
          platform: 'youtube',
          displayName: 'Original Name',
          rtmpUrl: 'rtmp://youtube.com/live',
          streamKey: encrypt('original-key'),
        },
      });
    });

    it('should update destination', async () => {
      const response = await request(app)
        .patch(`/api/destinations/${destination.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          displayName: 'Updated Name',
          isActive: false,
        })
        .expect(200);

      expect(response.body).toMatchObject({
        displayName: 'Updated Name',
        isActive: false,
      });

      // Verify database was updated
      const updated = await prisma.destination.findUnique({
        where: { id: destination.id },
      });
      expect(updated?.displayName).toBe('Updated Name');
      expect(updated?.isActive).toBe(false);
    });

    it('should update stream key with encryption', async () => {
      const response = await request(app)
        .patch(`/api/destinations/${destination.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          streamKey: 'new-stream-key',
        })
        .expect(200);

      // Verify key was encrypted in database
      const updated = await prisma.destination.findUnique({
        where: { id: destination.id },
      });
      expect(updated?.streamKey).not.toBe('new-stream-key');
      expect(decrypt(updated?.streamKey || '')).toBe('new-stream-key');
    });

    it('should not allow updating other users destinations', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'intruder@example.com',
          planType: 'free',
        },
      });

      const otherToken = generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const response = await request(app)
        .patch(`/api/destinations/${destination.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          displayName: 'Hacked',
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');

      // Verify destination was not updated
      const unchanged = await prisma.destination.findUnique({
        where: { id: destination.id },
      });
      expect(unchanged?.displayName).toBe('Original Name');
    });
  });

  describe('DELETE /api/destinations/:id', () => {
    let destination: any;

    beforeEach(async () => {
      destination = await prisma.destination.create({
        data: {
          userId: testUser.id,
          platform: 'youtube',
          displayName: 'To Be Deleted',
          rtmpUrl: 'rtmp://youtube.com/live',
          streamKey: encrypt('delete-key'),
        },
      });
    });

    it('should delete destination', async () => {
      const response = await request(app)
        .delete(`/api/destinations/${destination.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify destination was deleted
      const deleted = await prisma.destination.findUnique({
        where: { id: destination.id },
      });
      expect(deleted).toBeNull();
    });

    it('should not allow deleting other users destinations', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'deleter@example.com',
          planType: 'free',
        },
      });

      const otherToken = generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const response = await request(app)
        .delete(`/api/destinations/${destination.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');

      // Verify destination still exists
      const stillExists = await prisma.destination.findUnique({
        where: { id: destination.id },
      });
      expect(stillExists).toBeTruthy();
    });
  });

  describe('Platform-specific validation', () => {
    it('should validate YouTube RTMP URL format', async () => {
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'youtube',
          displayName: 'YouTube',
          rtmpUrl: 'invalid-url',
          streamKey: 'key',
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid RTMP URL');
    });

    it('should validate Twitch RTMP URL format', async () => {
      const response = await request(app)
        .post('/api/destinations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          platform: 'twitch',
          displayName: 'Twitch',
          rtmpUrl: 'rtmp://live.twitch.tv/app',
          streamKey: 'live_123_abc',
        })
        .expect(201);

      expect(response.body.platform).toBe('twitch');
    });
  });
});
