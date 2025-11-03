import { PrismaClient } from '@prisma/client';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/streamlick_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.SENDGRID_API_KEY = 'SG.mock';
process.env.FROM_EMAIL = 'test@streamlick.com';

// Global test timeout
jest.setTimeout(10000);

// Create a test database client
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Clean up database before each test
beforeEach(async () => {
  // Clean up test data in order (respecting foreign keys)
  await prisma.chatMessage.deleteMany({});
  await prisma.participant.deleteMany({});
  await prisma.broadcastDestination.deleteMany({});
  await prisma.destination.deleteMany({});
  await prisma.recording.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.studioTemplate.deleteMany({});
  await prisma.broadcast.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.user.deleteMany({});
});

// Close database connection after all tests
afterAll(async () => {
  await prisma.$disconnect();
});
