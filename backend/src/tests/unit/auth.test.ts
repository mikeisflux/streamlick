import request from 'supertest';
import express from 'express';
import authRouter from '../../api/auth.routes';
import prisma from '../../database/prisma';
import { generateMagicLinkToken, generateAccessToken } from '../../auth/jwt';
import * as emailService from '../../services/email';

// Mock dependencies
jest.mock('../../services/email');
jest.mock('../../auth/jwt');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Authentication API', () => {
  describe('POST /api/auth/send-magic-link', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (generateMagicLinkToken as jest.Mock).mockReturnValue('mock-token');
      (emailService.sendMagicLink as jest.Mock).mockResolvedValue(true);
    });

    it('should send magic link to new user', async () => {
      const email = 'newuser@example.com';

      const response = await request(app)
        .post('/api/auth/send-magic-link')
        .send({ email })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Magic link sent to your email',
      });

      // Verify user was created
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeTruthy();
      expect(user?.email).toBe(email);
      expect(user?.planType).toBe('free');

      // Verify email was sent
      expect(emailService.sendMagicLink).toHaveBeenCalledWith(email, 'mock-token');
    });

    it('should send magic link to existing user', async () => {
      const email = 'existing@example.com';

      // Create existing user
      await prisma.user.create({
        data: { email, planType: 'core' },
      });

      const response = await request(app)
        .post('/api/auth/send-magic-link')
        .send({ email })
        .expect(200);

      expect(response.body).toEqual({
        message: 'Magic link sent to your email',
      });

      // Verify no duplicate user was created
      const users = await prisma.user.findMany({ where: { email } });
      expect(users).toHaveLength(1);
      expect(users[0].planType).toBe('core'); // Plan should not change
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/send-magic-link')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Valid email is required',
      });

      expect(emailService.sendMagicLink).not.toHaveBeenCalled();
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/auth/send-magic-link')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Valid email is required',
      });
    });

    it('should handle email service errors gracefully', async () => {
      const email = 'test@example.com';
      (emailService.sendMagicLink as jest.Mock).mockRejectedValue(
        new Error('Email service down')
      );

      const response = await request(app)
        .post('/api/auth/send-magic-link')
        .send({ email })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to send magic link',
      });
    });
  });

  describe('POST /api/auth/verify-token', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should verify valid token and return user with tokens', async () => {
      const email = 'verified@example.com';
      const user = await prisma.user.create({
        data: { email, name: 'Test User', planType: 'free' },
      });

      (generateAccessToken as jest.Mock).mockReturnValue('access-token');
      (jest.spyOn(require('../../auth/jwt'), 'verifyMagicLinkToken') as jest.Mock)
        .mockReturnValue({ email });
      (jest.spyOn(require('../../auth/jwt'), 'generateRefreshToken') as jest.Mock)
        .mockReturnValue('refresh-token');

      const response = await request(app)
        .post('/api/auth/verify-token')
        .send({ token: 'valid-token' })
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: user.id,
          email: email,
          name: 'Test User',
          planType: 'free',
        },
      });
    });

    it('should reject invalid token', async () => {
      (jest.spyOn(require('../../auth/jwt'), 'verifyMagicLinkToken') as jest.Mock)
        .mockImplementation(() => {
          throw new Error('Invalid token');
        });

      const response = await request(app)
        .post('/api/auth/verify-token')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body).toEqual({
        error: 'Invalid or expired token',
      });
    });

    it('should reject missing token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-token')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Token is required',
      });
    });

    it('should handle non-existent user', async () => {
      (jest.spyOn(require('../../auth/jwt'), 'verifyMagicLinkToken') as jest.Mock)
        .mockReturnValue({ email: 'nonexistent@example.com' });

      const response = await request(app)
        .post('/api/auth/verify-token')
        .send({ token: 'valid-token' })
        .expect(404);

      expect(response.body).toEqual({
        error: 'User not found',
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return authenticated user', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'authenticated@example.com',
          name: 'Auth User',
          planType: 'core',
        },
      });

      const token = generateAccessToken({ userId: user.id, email: user.email });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: user.id,
        email: user.email,
        name: 'Auth User',
        planType: 'core',
      });
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PATCH /api/auth/profile', () => {
    it('should update user profile', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'update@example.com',
          name: 'Old Name',
        },
      });

      const token = generateAccessToken({ userId: user.id, email: user.email });

      const response = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'New Name',
          avatarUrl: 'https://example.com/avatar.jpg',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'New Name',
        avatarUrl: 'https://example.com/avatar.jpg',
      });

      // Verify database was updated
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser?.name).toBe('New Name');
      expect(updatedUser?.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should reject unauthenticated profile updates', async () => {
      const response = await request(app)
        .patch('/api/auth/profile')
        .send({ name: 'Hacker' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
