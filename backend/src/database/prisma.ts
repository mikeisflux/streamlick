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
    logger.info('Prisma Query:', {
      query: sanitizeQuery(e.query),
      duration: `${e.duration}ms`,
      // Only log params in very verbose mode (opt-in via PRISMA_LOG_PARAMS=true)
      params: process.env.PRISMA_LOG_PARAMS === 'true' ? e.params : '[redacted]'
    });
  });
}

prisma.$connect()
  .then(() => logger.info('Database connected'))
  .catch((err: any) => logger.error('Database connection error:', err));

export default prisma;
