/**
 * Frontend logger service
 *
 * Provides structured logging for the frontend with different log levels.
 * In production, errors are sent to the console but debug/info logs are suppressed.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment = import.meta.env.DEV;

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) {
      return true; // Log everything in development
    }
    // In production, only log warnings and errors
    return level === 'warn' || level === 'error';
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  /**
   * Log performance metrics
   */
  performance(message: string, metrics: Record<string, any>): void {
    if (this.shouldLog('info')) {
    }
  }
}

export const logger = new Logger();
export default logger;
