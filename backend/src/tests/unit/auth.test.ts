import request from 'supertest';
import express from 'express';
import authRouter from '../../api/auth.routes';
import prisma from '../../database/prisma';
import { generateAccessToken } from '../../auth/jwt';
import * as emailService from '../../services/email';

// Mock dependencies
jest.mock('../../services/email');
jest.mock('../../auth/jwt');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Authentication API', () => {

  describe('GET /api/auth/me', () => {
    it('should return authenticated user', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'authenticated@example.com',
          name: 'Auth User',
          planType: 'core',
          password: 'testpassword123',
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
          password: 'testpassword123',
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
