/**
 * Frontend logger service
 *
 * Provides structured logging for the frontend with different log levels.
 * ALL logs are output regardless of environment for full debugging visibility.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  debug(message: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  /**
   * Log performance metrics
   */
  performance(message: string, metrics: Record<string, any>): void {
    console.info(`[PERF] ${message}`, metrics);
  }
}

export const logger = new Logger();
export default logger;
