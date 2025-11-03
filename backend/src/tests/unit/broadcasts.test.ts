import request from 'supertest';
import express from 'express';
import broadcastsRouter from '../../api/broadcasts.routes';
import prisma from '../../database/prisma';
import { generateAccessToken } from '../../auth/jwt';

const app = express();
app.use(express.json());
app.use('/api/broadcasts', broadcastsRouter);

describe('Broadcasts API', () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'broadcaster@example.com',
        name: 'Test Broadcaster',
        planType: 'core',
      },
    });

    authToken = generateAccessToken({
      userId: testUser.id,
      email: testUser.email,
    });
  });

  describe('POST /api/broadcasts', () => {
    it('should create a new broadcast', async () => {
      const response = await request(app)
        .post('/api/broadcasts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'My First Stream',
          description: 'Testing the platform',
        })
        .expect(201);

      expect(response.body).toMatchObject({
        title: 'My First Stream',
        description: 'Testing the platform',
        status: 'scheduled',
        userId: testUser.id,
      });

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
    });

    it('should reject broadcast without title', async () => {
      const response = await request(app)
        .post('/api/broadcasts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'No title provided',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should create broadcast with studio config', async () => {
      const studioConfig = {
        layout: 'grid',
        backgroundColor: '#000000',
        logo: {
          url: 'https://example.com/logo.png',
          position: 'top-left',
        },
      };

      const response = await request(app)
        .post('/api/broadcasts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Configured Stream',
          studioConfig,
        })
        .expect(201);

      expect(response.body.studioConfig).toEqual(studioConfig);
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/broadcasts')
        .send({
          title: 'Unauthorized Stream',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/broadcasts', () => {
    beforeEach(async () => {
      // Create test broadcasts
      await prisma.broadcast.createMany({
        data: [
          {
            userId: testUser.id,
            title: 'Stream 1',
            status: 'scheduled',
          },
          {
            userId: testUser.id,
            title: 'Stream 2',
            status: 'live',
          },
          {
            userId: testUser.id,
            title: 'Stream 3',
            status: 'ended',
          },
        ],
      });
    });

    it('should list all user broadcasts', async () => {
      const response = await request(app)
        .get('/api/broadcasts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body[0]).toHaveProperty('title');
      expect(response.body[0]).toHaveProperty('status');
    });

    it('should filter broadcasts by status', async () => {
      const response = await request(app)
        .get('/api/broadcasts?status=live')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('live');
    });

    it('should not show other users broadcasts', async () => {
      // Create another user with broadcasts
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          planType: 'free',
        },
      });

      await prisma.broadcast.create({
        data: {
          userId: otherUser.id,
          title: 'Other User Stream',
          status: 'scheduled',
        },
      });

      const response = await request(app)
        .get('/api/broadcasts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.every((b: any) => b.userId === testUser.id)).toBe(true);
    });
  });

  describe('GET /api/broadcasts/:id', () => {
    let broadcast: any;

    beforeEach(async () => {
      broadcast = await prisma.broadcast.create({
        data: {
          userId: testUser.id,
          title: 'Test Stream',
          description: 'Detailed stream',
          status: 'scheduled',
        },
      });
    });

    it('should get broadcast details', async () => {
      const response = await request(app)
        .get(`/api/broadcasts/${broadcast.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: broadcast.id,
        title: 'Test Stream',
        description: 'Detailed stream',
        status: 'scheduled',
      });
    });

    it('should return 404 for non-existent broadcast', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/api/broadcasts/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should not allow access to other users broadcasts', async () => {
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
        .get(`/api/broadcasts/${broadcast.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/broadcasts/:id', () => {
    let broadcast: any;

    beforeEach(async () => {
      broadcast = await prisma.broadcast.create({
        data: {
          userId: testUser.id,
          title: 'Original Title',
          status: 'scheduled',
        },
      });
    });

    it('should update broadcast', async () => {
      const response = await request(app)
        .patch(`/api/broadcasts/${broadcast.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
          description: 'New description',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        title: 'Updated Title',
        description: 'New description',
      });

      // Verify database was updated
      const updatedBroadcast = await prisma.broadcast.findUnique({
        where: { id: broadcast.id },
      });
      expect(updatedBroadcast?.title).toBe('Updated Title');
    });

    it('should not allow updating other users broadcasts', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: 'hacker@example.com',
          planType: 'free',
        },
      });

      const otherToken = generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const response = await request(app)
        .patch(`/api/broadcasts/${broadcast.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          title: 'Hacked Title',
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');

      // Verify broadcast was not updated
      const unchangedBroadcast = await prisma.broadcast.findUnique({
        where: { id: broadcast.id },
      });
      expect(unchangedBroadcast?.title).toBe('Original Title');
    });
  });

  describe('DELETE /api/broadcasts/:id', () => {
    let broadcast: any;

    beforeEach(async () => {
      broadcast = await prisma.broadcast.create({
        data: {
          userId: testUser.id,
          title: 'To Be Deleted',
          status: 'scheduled',
        },
      });
    });

    it('should delete broadcast', async () => {
      const response = await request(app)
        .delete(`/api/broadcasts/${broadcast.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify broadcast was deleted
      const deletedBroadcast = await prisma.broadcast.findUnique({
        where: { id: broadcast.id },
      });
      expect(deletedBroadcast).toBeNull();
    });

    it('should not allow deleting other users broadcasts', async () => {
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
        .delete(`/api/broadcasts/${broadcast.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');

      // Verify broadcast still exists
      const stillExists = await prisma.broadcast.findUnique({
        where: { id: broadcast.id },
      });
      expect(stillExists).toBeTruthy();
    });
  });

  describe('POST /api/broadcasts/:id/start', () => {
    let broadcast: any;

    beforeEach(async () => {
      broadcast = await prisma.broadcast.create({
        data: {
          userId: testUser.id,
          title: 'Ready to Go Live',
          status: 'scheduled',
        },
      });
    });

    it('should start broadcast', async () => {
      const response = await request(app)
        .post(`/api/broadcasts/${broadcast.id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('live');
      expect(response.body).toHaveProperty('startedAt');

      // Verify database was updated
      const liveBroadcast = await prisma.broadcast.findUnique({
        where: { id: broadcast.id },
      });
      expect(liveBroadcast?.status).toBe('live');
      expect(liveBroadcast?.startedAt).toBeTruthy();
    });

    it('should not allow starting already live broadcast', async () => {
      // First start
      await request(app)
        .post(`/api/broadcasts/${broadcast.id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to start again
      const response = await request(app)
        .post(`/api/broadcasts/${broadcast.id}/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/broadcasts/:id/end', () => {
    let broadcast: any;

    beforeEach(async () => {
      broadcast = await prisma.broadcast.create({
        data: {
          userId: testUser.id,
          title: 'Live Stream',
          status: 'live',
          startedAt: new Date(),
        },
      });
    });

    it('should end broadcast', async () => {
      const response = await request(app)
        .post(`/api/broadcasts/${broadcast.id}/end`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('ended');
      expect(response.body).toHaveProperty('endedAt');
      expect(response.body).toHaveProperty('durationSeconds');

      // Verify database was updated
      const endedBroadcast = await prisma.broadcast.findUnique({
        where: { id: broadcast.id },
      });
      expect(endedBroadcast?.status).toBe('ended');
      expect(endedBroadcast?.endedAt).toBeTruthy();
      expect(endedBroadcast?.durationSeconds).toBeGreaterThan(0);
    });

    it('should not allow ending non-live broadcast', async () => {
      const scheduledBroadcast = await prisma.broadcast.create({
        data: {
          userId: testUser.id,
          title: 'Not Live Yet',
          status: 'scheduled',
        },
      });

      const response = await request(app)
        .post(`/api/broadcasts/${scheduledBroadcast.id}/end`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
