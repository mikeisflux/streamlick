import request from 'supertest';
import express from 'express';
import participantsRouter from '../../api/participants.routes';
import participantControlRoutes from '../../routes/participant.routes';
import prisma from '../../database/prisma';
import { generateAccessToken } from '../../auth/jwt';

const app = express();
app.use(express.json());
app.use('/api/participants', participantsRouter);
app.use('/api/broadcasts', participantControlRoutes);

describe('Participant Management Integration Tests', () => {
  let hostUser: any;
  let guestUser: any;
  let testBroadcast: any;
  let hostToken: string;
  let guestToken: string;

  beforeEach(async () => {
    // Create test users
    hostUser = await prisma.user.create({
      data: {
        email: 'host@participants.test',
        name: 'Host User',
        planType: 'core',
      },
    });

    guestUser = await prisma.user.create({
      data: {
        email: 'guest@participants.test',
        name: 'Guest User',
        planType: 'free',
      },
    });

    hostToken = generateAccessToken({ userId: hostUser.id, email: hostUser.email });
    guestToken = generateAccessToken({ userId: guestUser.id, email: guestUser.email });

    // Create test broadcast
    testBroadcast = await prisma.broadcast.create({
      data: {
        userId: hostUser.id,
        title: 'Participant Test Broadcast',
        status: 'live',
        startedAt: new Date(),
      },
    });
  });

  describe('Participant Invitation', () => {
    it('should generate guest invite link', async () => {
      const response = await request(app)
        .post('/api/participants')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          broadcastId: testBroadcast.id,
          name: 'Invited Guest',
          role: 'guest',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('joinLinkToken');
      expect(response.body.name).toBe('Invited Guest');
      expect(response.body.role).toBe('guest');
      expect(response.body.status).toBe('invited');
    });

    it('should create multiple guest invites', async () => {
      const guests = ['Guest 1', 'Guest 2', 'Guest 3'];

      for (const guestName of guests) {
        const response = await request(app)
          .post('/api/participants')
          .set('Authorization', `Bearer ${hostToken}`)
          .send({
            broadcastId: testBroadcast.id,
            name: guestName,
            role: 'guest',
          })
          .expect(201);

        expect(response.body.name).toBe(guestName);
      }

      const participants = await prisma.participant.findMany({
        where: { broadcastId: testBroadcast.id },
      });

      expect(participants).toHaveLength(3);
    });

    it('should generate unique join tokens', async () => {
      const response1 = await request(app)
        .post('/api/participants')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          broadcastId: testBroadcast.id,
          name: 'Guest A',
          role: 'guest',
        })
        .expect(201);

      const response2 = await request(app)
        .post('/api/participants')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          broadcastId: testBroadcast.id,
          name: 'Guest B',
          role: 'guest',
        })
        .expect(201);

      expect(response1.body.joinLinkToken).not.toBe(response2.body.joinLinkToken);
    });
  });

  describe('Guest Join Flow', () => {
    let joinToken: string;
    let participantId: string;

    beforeEach(async () => {
      const participant = await prisma.participant.create({
        data: {
          broadcastId: testBroadcast.id,
          name: 'Test Guest',
          role: 'guest',
          status: 'invited',
          joinLinkToken: 'test-join-token-123',
        },
      });
      joinToken = participant.joinLinkToken!;
      participantId = participant.id;
    });

    it('should allow guest to join via token', async () => {
      const response = await request(app)
        .post(`/api/participants/join/${joinToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('participantId', participantId);
      expect(response.body).toHaveProperty('broadcastId', testBroadcast.id);
      expect(response.body).toHaveProperty('broadcast');

      // Verify status updated in database
      const updatedParticipant = await prisma.participant.findUnique({
        where: { id: participantId },
      });
      expect(updatedParticipant?.status).toBe('joined');
      expect(updatedParticipant?.joinedAt).toBeTruthy();
    });

    it('should reject invalid join token', async () => {
      const response = await request(app)
        .post('/api/participants/join/invalid-token')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should allow rejoining with same token', async () => {
      // First join
      await request(app)
        .post(`/api/participants/join/${joinToken}`)
        .expect(200);

      // Second join (reconnect)
      const response = await request(app)
        .post(`/api/participants/join/${joinToken}`)
        .expect(200);

      expect(response.body.participantId).toBe(participantId);
    });
  });

  describe('Participant List Management', () => {
    beforeEach(async () => {
      // Create multiple participants
      await prisma.participant.createMany({
        data: [
          {
            broadcastId: testBroadcast.id,
            userId: hostUser.id,
            name: 'Host',
            role: 'host',
            status: 'joined',
            joinedAt: new Date(),
          },
          {
            broadcastId: testBroadcast.id,
            name: 'Guest 1',
            role: 'guest',
            status: 'joined',
            joinedAt: new Date(),
          },
          {
            broadcastId: testBroadcast.id,
            name: 'Guest 2',
            role: 'guest',
            status: 'invited',
          },
          {
            broadcastId: testBroadcast.id,
            name: 'Backstage Guest',
            role: 'backstage',
            status: 'joined',
            joinedAt: new Date(),
          },
        ],
      });
    });

    it('should list all broadcast participants', async () => {
      const response = await request(app)
        .get(`/api/participants?broadcastId=${testBroadcast.id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(response.body).toHaveLength(4);
    });

    it('should filter participants by status', async () => {
      const response = await request(app)
        .get(`/api/participants?broadcastId=${testBroadcast.id}&status=joined`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.every((p: any) => p.status === 'joined')).toBe(true);
    });

    it('should filter participants by role', async () => {
      const response = await request(app)
        .get(`/api/participants?broadcastId=${testBroadcast.id}&role=guest`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body.every((p: any) => p.role === 'guest')).toBe(true);
    });
  });

  describe('Participant Control (Mute/Unmute/Volume)', () => {
    let participant: any;

    beforeEach(async () => {
      participant = await prisma.participant.create({
        data: {
          broadcastId: testBroadcast.id,
          userId: guestUser.id,
          name: 'Controllable Guest',
          role: 'guest',
          status: 'joined',
        },
      });
    });

    it('should allow host to mute participant', async () => {
      const response = await request(app)
        .post(`/api/broadcasts/${testBroadcast.id}/participants/${participant.id}/mute`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ type: 'audio' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should allow host to unmute participant', async () => {
      const response = await request(app)
        .post(`/api/broadcasts/${testBroadcast.id}/participants/${participant.id}/unmute`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ type: 'audio' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should allow host to adjust participant volume', async () => {
      const response = await request(app)
        .post(`/api/broadcasts/${testBroadcast.id}/participants/${participant.id}/volume`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ volume: 75 })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject volume outside valid range', async () => {
      const response = await request(app)
        .post(`/api/broadcasts/${testBroadcast.id}/participants/${participant.id}/volume`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ volume: 150 })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should not allow guest to control other participants', async () => {
      const response = await request(app)
        .post(`/api/broadcasts/${testBroadcast.id}/participants/${participant.id}/mute`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ type: 'audio' })
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Participant Removal (Kick)', () => {
    let participant: any;

    beforeEach(async () => {
      participant = await prisma.participant.create({
        data: {
          broadcastId: testBroadcast.id,
          userId: guestUser.id,
          name: 'Kickable Guest',
          role: 'guest',
          status: 'joined',
        },
      });
    });

    it('should allow host to kick participant', async () => {
      const response = await request(app)
        .post(`/api/broadcasts/${testBroadcast.id}/participants/${participant.id}/kick`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify participant status updated
      const updatedParticipant = await prisma.participant.findUnique({
        where: { id: participant.id },
      });
      expect(updatedParticipant?.status).toBe('disconnected');
      expect(updatedParticipant?.leftAt).toBeTruthy();
    });

    it('should not allow guest to kick other participants', async () => {
      const response = await request(app)
        .post(`/api/broadcasts/${testBroadcast.id}/participants/${participant.id}/kick`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Participant Ban', () => {
    let participant: any;

    beforeEach(async () => {
      participant = await prisma.participant.create({
        data: {
          broadcastId: testBroadcast.id,
          userId: guestUser.id,
          name: 'Bannable Guest',
          role: 'guest',
          status: 'joined',
        },
      });
    });

    it('should allow host to ban participant', async () => {
      const response = await request(app)
        .post(`/api/broadcasts/${testBroadcast.id}/participants/${participant.id}/ban`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ reason: 'Inappropriate behavior' })
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify ban record created
      const ban = await prisma.bannedParticipant.findFirst({
        where: {
          broadcastId: testBroadcast.id,
          userId: guestUser.id,
        },
      });
      expect(ban).toBeTruthy();
      expect(ban?.reason).toBe('Inappropriate behavior');
      expect(ban?.bannedBy).toBe(hostUser.id);
    });

    it('should prevent banned user from rejoining', async () => {
      // Ban the user
      await request(app)
        .post(`/api/broadcasts/${testBroadcast.id}/participants/${participant.id}/ban`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ reason: 'Test ban' })
        .expect(200);

      // Try to create new participant with banned user
      const response = await request(app)
        .post('/api/participants')
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          broadcastId: testBroadcast.id,
          userId: guestUser.id,
          name: 'Trying to rejoin',
          role: 'guest',
        })
        .expect(403);

      expect(response.body.error).toContain('banned');
    });

    it('should allow host to unban participant', async () => {
      // First ban
      await request(app)
        .post(`/api/broadcasts/${testBroadcast.id}/participants/${participant.id}/ban`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ reason: 'Test ban' })
        .expect(200);

      // Then unban
      const response = await request(app)
        .delete(`/api/broadcasts/${testBroadcast.id}/bans/${guestUser.id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify ban removed
      const ban = await prisma.bannedParticipant.findFirst({
        where: {
          broadcastId: testBroadcast.id,
          userId: guestUser.id,
        },
      });
      expect(ban).toBeNull();
    });
  });

  describe('Backstage Management', () => {
    let backstageParticipant: any;
    let liveParticipant: any;

    beforeEach(async () => {
      backstageParticipant = await prisma.participant.create({
        data: {
          broadcastId: testBroadcast.id,
          name: 'Backstage Guest',
          role: 'backstage',
          status: 'joined',
        },
      });

      liveParticipant = await prisma.participant.create({
        data: {
          broadcastId: testBroadcast.id,
          name: 'Live Guest',
          role: 'guest',
          status: 'joined',
        },
      });
    });

    it('should move participant from backstage to live', async () => {
      const response = await request(app)
        .patch(`/api/participants/${backstageParticipant.id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ role: 'guest' })
        .expect(200);

      expect(response.body.role).toBe('guest');

      // Verify database updated
      const updated = await prisma.participant.findUnique({
        where: { id: backstageParticipant.id },
      });
      expect(updated?.role).toBe('guest');
    });

    it('should move participant from live to backstage', async () => {
      const response = await request(app)
        .patch(`/api/participants/${liveParticipant.id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ role: 'backstage' })
        .expect(200);

      expect(response.body.role).toBe('backstage');
    });

    it('should enforce plan limits on live participants', async () => {
      // Update user to free plan (max 6 participants)
      await prisma.user.update({
        where: { id: hostUser.id },
        data: { planType: 'free' },
      });

      // Create 6 live participants
      for (let i = 0; i < 6; i++) {
        await prisma.participant.create({
          data: {
            broadcastId: testBroadcast.id,
            name: `Guest ${i}`,
            role: 'guest',
            status: 'joined',
          },
        });
      }

      // Try to add 7th
      const response = await request(app)
        .patch(`/api/participants/${backstageParticipant.id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ role: 'guest' })
        .expect(403);

      expect(response.body.error).toContain('plan limit');
    });
  });

  describe('Participant Update', () => {
    let participant: any;

    beforeEach(async () => {
      participant = await prisma.participant.create({
        data: {
          broadcastId: testBroadcast.id,
          name: 'Updatable Guest',
          role: 'guest',
          status: 'joined',
        },
      });
    });

    it('should allow updating participant name', async () => {
      const response = await request(app)
        .patch(`/api/participants/${participant.id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
    });

    it('should allow updating participant role', async () => {
      const response = await request(app)
        .patch(`/api/participants/${participant.id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ role: 'backstage' })
        .expect(200);

      expect(response.body.role).toBe('backstage');
    });
  });

  describe('Participant Deletion', () => {
    let participant: any;

    beforeEach(async () => {
      participant = await prisma.participant.create({
        data: {
          broadcastId: testBroadcast.id,
          name: 'Deletable Guest',
          role: 'guest',
          status: 'invited',
        },
      });
    });

    it('should allow host to delete invited participant', async () => {
      const response = await request(app)
        .delete(`/api/participants/${participant.id}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify deleted from database
      const deleted = await prisma.participant.findUnique({
        where: { id: participant.id },
      });
      expect(deleted).toBeNull();
    });

    it('should not allow guest to delete participants', async () => {
      const response = await request(app)
        .delete(`/api/participants/${participant.id}`)
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });
});
