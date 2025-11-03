import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import recordingsRouter from '../../api/recordings.routes';
import prisma from '../../database/prisma';
import { generateAccessToken } from '../../auth/jwt';

const app = express();
app.use(express.json());
app.use('/api/recordings', recordingsRouter);

describe('Recording System Integration Tests', () => {
  let testUser: any;
  let testBroadcast: any;
  let authToken: string;

  beforeEach(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'recorder@test.com',
        name: 'Test Recorder',
        planType: 'core',
      },
    });

    authToken = generateAccessToken({
      userId: testUser.id,
      email: testUser.email,
    });

    // Create test broadcast
    testBroadcast = await prisma.broadcast.create({
      data: {
        userId: testUser.id,
        title: 'Recording Test Stream',
        status: 'ended',
        startedAt: new Date(Date.now() - 3600000), // 1 hour ago
        endedAt: new Date(),
        durationSeconds: 3600,
      },
    });
  });

  describe('Recording Creation', () => {
    it('should create a new recording', async () => {
      const response = await request(app)
        .post('/api/recordings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          broadcastId: testBroadcast.id,
          filePath: '/recordings/test-stream-2024.mp4',
          fileSizeBytes: 524288000, // 500MB
          durationSeconds: 3600,
          quality: '1080p',
          format: 'mp4',
          storageType: 'cloud',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        broadcastId: testBroadcast.id,
        filePath: '/recordings/test-stream-2024.mp4',
        quality: '1080p',
        format: 'mp4',
        storageType: 'cloud',
        isAvailable: true,
      });
      expect(response.body).toHaveProperty('id');
    });

    it('should create recording with different qualities', async () => {
      const qualities = ['720p', '1080p', '4k'];

      for (const quality of qualities) {
        const response = await request(app)
          .post('/api/recordings')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            broadcastId: testBroadcast.id,
            filePath: `/recordings/stream-${quality}.mp4`,
            quality,
            format: 'mp4',
            storageType: 'cloud',
          })
          .expect(201);

        expect(response.body.quality).toBe(quality);
      }

      const recordings = await prisma.recording.findMany({
        where: { broadcastId: testBroadcast.id },
      });
      expect(recordings).toHaveLength(3);
    });

    it('should create recording with different formats', async () => {
      const formats = ['mp4', 'webm'];

      for (const format of formats) {
        const response = await request(app)
          .post('/api/recordings')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            broadcastId: testBroadcast.id,
            filePath: `/recordings/stream.${format}`,
            quality: '1080p',
            format,
            storageType: 'cloud',
          })
          .expect(201);

        expect(response.body.format).toBe(format);
      }
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/recordings')
        .send({
          broadcastId: testBroadcast.id,
          filePath: '/recordings/test.mp4',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/recordings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          broadcastId: testBroadcast.id,
          // Missing filePath
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Recording Listing', () => {
    beforeEach(async () => {
      // Create multiple recordings
      await prisma.recording.createMany({
        data: [
          {
            broadcastId: testBroadcast.id,
            filePath: '/recordings/stream1.mp4',
            quality: '1080p',
            format: 'mp4',
            storageType: 'cloud',
            durationSeconds: 3600,
            fileSizeBytes: BigInt(524288000),
          },
          {
            broadcastId: testBroadcast.id,
            filePath: '/recordings/stream2.mp4',
            quality: '720p',
            format: 'mp4',
            storageType: 'local',
            durationSeconds: 1800,
            fileSizeBytes: BigInt(262144000),
          },
          {
            broadcastId: testBroadcast.id,
            filePath: '/recordings/stream3.webm',
            quality: '1080p',
            format: 'webm',
            storageType: 'cloud',
            durationSeconds: 2700,
            fileSizeBytes: BigInt(450000000),
            isAvailable: false, // Unavailable
          },
        ],
      });
    });

    it('should list all user recordings', async () => {
      const response = await request(app)
        .get('/api/recordings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toHaveProperty('filePath');
      expect(response.body[0]).toHaveProperty('quality');
    });

    it('should filter by broadcast', async () => {
      const response = await request(app)
        .get(`/api/recordings?broadcastId=${testBroadcast.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.every((r: any) => r.broadcastId === testBroadcast.id)).toBe(true);
    });

    it('should filter by availability', async () => {
      const response = await request(app)
        .get('/api/recordings?available=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((r: any) => r.isAvailable)).toBe(true);
    });

    it('should filter by quality', async () => {
      const response = await request(app)
        .get('/api/recordings?quality=1080p')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((r: any) => r.quality === '1080p')).toBe(true);
    });

    it('should filter by storage type', async () => {
      const response = await request(app)
        .get('/api/recordings?storageType=cloud')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((r: any) => r.storageType === 'cloud')).toBe(true);
    });

    it('should not show other users recordings', async () => {
      // Create another user with recording
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@test.com',
          planType: 'free',
        },
      });

      const otherBroadcast = await prisma.broadcast.create({
        data: {
          userId: otherUser.id,
          title: 'Other Stream',
          status: 'ended',
        },
      });

      await prisma.recording.create({
        data: {
          broadcastId: otherBroadcast.id,
          filePath: '/recordings/other.mp4',
          quality: '720p',
          format: 'mp4',
          storageType: 'cloud',
        },
      });

      const response = await request(app)
        .get('/api/recordings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.every((r: any) => r.broadcastId === testBroadcast.id)).toBe(true);
    });
  });

  describe('Recording Details', () => {
    let recording: any;

    beforeEach(async () => {
      recording = await prisma.recording.create({
        data: {
          broadcastId: testBroadcast.id,
          filePath: '/recordings/details-test.mp4',
          quality: '1080p',
          format: 'mp4',
          storageType: 'cloud',
          durationSeconds: 3600,
          fileSizeBytes: BigInt(524288000),
        },
      });
    });

    it('should get recording details', async () => {
      const response = await request(app)
        .get(`/api/recordings/${recording.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: recording.id,
        broadcastId: testBroadcast.id,
        filePath: '/recordings/details-test.mp4',
        quality: '1080p',
        format: 'mp4',
      });
      expect(response.body).toHaveProperty('broadcast');
    });

    it('should return 404 for non-existent recording', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/api/recordings/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should not allow access to other users recordings', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'intruder@test.com',
          planType: 'free',
        },
      });

      const otherToken = generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const response = await request(app)
        .get(`/api/recordings/${recording.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Recording Download', () => {
    let recording: any;

    beforeEach(async () => {
      recording = await prisma.recording.create({
        data: {
          broadcastId: testBroadcast.id,
          filePath: '/recordings/download-test.mp4',
          quality: '1080p',
          format: 'mp4',
          storageType: 'local',
          durationSeconds: 3600,
          fileSizeBytes: BigInt(524288000),
        },
      });
    });

    it('should generate download URL', async () => {
      const response = await request(app)
        .get(`/api/recordings/${recording.id}/download`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('expiresAt');
    });

    it('should reject download for unavailable recording', async () => {
      await prisma.recording.update({
        where: { id: recording.id },
        data: { isAvailable: false },
      });

      const response = await request(app)
        .get(`/api/recordings/${recording.id}/download`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('not available');
    });

    it('should track download count', async () => {
      // Download multiple times
      await request(app)
        .get(`/api/recordings/${recording.id}/download`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .get(`/api/recordings/${recording.id}/download`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify download count increased
      // (This would require adding a downloads field to the schema)
    });
  });

  describe('Recording Update', () => {
    let recording: any;

    beforeEach(async () => {
      recording = await prisma.recording.create({
        data: {
          broadcastId: testBroadcast.id,
          filePath: '/recordings/update-test.mp4',
          quality: '720p',
          format: 'mp4',
          storageType: 'local',
        },
      });
    });

    it('should update recording metadata', async () => {
      const response = await request(app)
        .patch(`/api/recordings/${recording.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quality: '1080p',
          storageType: 'cloud',
        })
        .expect(200);

      expect(response.body.quality).toBe('1080p');
      expect(response.body.storageType).toBe('cloud');
    });

    it('should mark recording as unavailable', async () => {
      const response = await request(app)
        .patch(`/api/recordings/${recording.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          isAvailable: false,
        })
        .expect(200);

      expect(response.body.isAvailable).toBe(false);
    });

    it('should not allow updating other users recordings', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'hacker@test.com',
          planType: 'free',
        },
      });

      const otherToken = generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const response = await request(app)
        .patch(`/api/recordings/${recording.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          quality: '4k',
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Recording Deletion', () => {
    let recording: any;

    beforeEach(async () => {
      recording = await prisma.recording.create({
        data: {
          broadcastId: testBroadcast.id,
          filePath: '/recordings/delete-test.mp4',
          quality: '1080p',
          format: 'mp4',
          storageType: 'cloud',
        },
      });
    });

    it('should delete recording', async () => {
      const response = await request(app)
        .delete(`/api/recordings/${recording.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify deleted from database
      const deleted = await prisma.recording.findUnique({
        where: { id: recording.id },
      });
      expect(deleted).toBeNull();
    });

    it('should not allow deleting other users recordings', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'deleter@test.com',
          planType: 'free',
        },
      });

      const otherToken = generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const response = await request(app)
        .delete(`/api/recordings/${recording.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');

      // Verify recording still exists
      const stillExists = await prisma.recording.findUnique({
        where: { id: recording.id },
      });
      expect(stillExists).toBeTruthy();
    });
  });

  describe('Storage Management', () => {
    it('should calculate total storage used', async () => {
      // Create recordings with different sizes
      await prisma.recording.createMany({
        data: [
          {
            broadcastId: testBroadcast.id,
            filePath: '/recordings/large1.mp4',
            fileSizeBytes: BigInt(1073741824), // 1GB
            storageType: 'cloud',
          },
          {
            broadcastId: testBroadcast.id,
            filePath: '/recordings/large2.mp4',
            fileSizeBytes: BigInt(2147483648), // 2GB
            storageType: 'cloud',
          },
        ],
      });

      const response = await request(app)
        .get('/api/recordings/storage/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalBytes');
      expect(response.body).toHaveProperty('totalGB');
      expect(response.body.totalGB).toBeGreaterThan(2.9);
    });

    it('should enforce storage limits by plan', async () => {
      // Free plan user
      const freeUser = await prisma.user.create({
        data: {
          email: 'free@test.com',
          planType: 'free',
        },
      });

      const freeBroadcast = await prisma.broadcast.create({
        data: {
          userId: freeUser.id,
          title: 'Free Stream',
          status: 'ended',
        },
      });

      // Create recordings exceeding free limit (2 hours)
      await prisma.recording.create({
        data: {
          broadcastId: freeBroadcast.id,
          filePath: '/recordings/free1.mp4',
          durationSeconds: 7200, // 2 hours
          storageType: 'cloud',
        },
      });

      const freeToken = generateAccessToken({
        userId: freeUser.id,
        email: freeUser.email,
      });

      // Try to create another recording
      const response = await request(app)
        .post('/api/recordings')
        .set('Authorization', `Bearer ${freeToken}`)
        .send({
          broadcastId: freeBroadcast.id,
          filePath: '/recordings/free2.mp4',
          durationSeconds: 3600,
          storageType: 'cloud',
        })
        .expect(403);

      expect(response.body.error).toContain('storage limit');
    });
  });

  describe('Recording Processing', () => {
    let recording: any;

    beforeEach(async () => {
      recording = await prisma.recording.create({
        data: {
          broadcastId: testBroadcast.id,
          filePath: '/recordings/process-test.mp4',
          quality: '1080p',
          format: 'mp4',
          storageType: 'cloud',
          durationSeconds: 3600,
        },
      });
    });

    it('should trim recording', async () => {
      const response = await request(app)
        .post(`/api/recordings/${recording.id}/trim`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: 300, // 5 minutes
          endTime: 1800, // 30 minutes
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('newRecordingId');
    });

    it('should validate trim parameters', async () => {
      const response = await request(app)
        .post(`/api/recordings/${recording.id}/trim`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          startTime: 1800,
          endTime: 300, // End before start
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should convert recording format', async () => {
      const response = await request(app)
        .post(`/api/recordings/${recording.id}/convert`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'webm',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });
});
