import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

// Sanitize query logs to prevent exposing sensitive data like passwords
const sanitizeQuery = (query: string): string => {
  // Remove potential sensitive data patterns
  return query
    .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
    .replace(/password\s*=\s*"[^"]*"/gi, 'password="***"')
    .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
    .replace(/token\s*=\s*"[^"]*"/gi, 'token="***"')
    .replace(/secret\s*=\s*'[^']*'/gi, "secret='***'")
    .replace(/secret\s*=\s*"[^"]*"/gi, 'secret="***"')
    .replace(/key\s*=\s*'[^']*'/gi, "key='***'")
    .replace(/key\s*=\s*"[^"]*"/gi, 'key="***"');
};

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' }
      ]
    : [{ level: 'error', emit: 'stdout' }],
});

// Custom query logging with sanitization in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    // Query logging disabled
  });
}

prisma.$connect()
  .then(() => logger.info('Database connected'))
  .catch((err: any) => logger.error('Database connection error:', err));

/**
 * BEST PRACTICE: Graceful database disconnection for shutdown
 * Ensures all pending queries complete and connection pool is closed
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    logger.info('Disconnecting from database...');
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
    throw error;
  }
}

export default prisma;
