import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

/**
 * BEST PRACTICE: Export Prisma transaction type for type-safe transactions
 * This allows functions to specify they need a transaction client
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

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

/**
 * BEST PRACTICE: Transaction helper with automatic rollback on error
 *
 * Wraps multiple database operations in a transaction to ensure atomicity.
 * If any operation fails, all changes are rolled back.
 *
 * @param fn - Function containing database operations
 * @param options - Optional transaction options (maxWait, timeout)
 * @returns Result of the transaction function
 *
 * @example
 * ```ts
 * const result = await withTransaction(async (tx) => {
 *   const user = await tx.user.create({ data: { ... } });
 *   await tx.refreshToken.create({ data: { userId: user.id, ... } });
 *   return user;
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (tx: PrismaTransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
  }
): Promise<T> {
  const defaultOptions = {
    maxWait: 5000,   // 5 seconds max wait for transaction slot
    timeout: 30000,  // 30 seconds timeout for transaction
    ...options,
  };

  try {
    return await prisma.$transaction(fn, defaultOptions);
  } catch (error: unknown) {
    // Log transaction failure for debugging
    // Check for Prisma error structure (has code and message)
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      const prismaError = error as { code: string; message: string };
      logger.error(`Transaction failed with Prisma error: ${prismaError.code} - ${prismaError.message}`);
    } else {
      logger.error('Transaction failed:', error);
    }
    throw error;
  }
}

export default prisma;
