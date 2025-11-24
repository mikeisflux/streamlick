import winston from 'winston';

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp}: ${message}`;
  })
);

const logger = winston.createLogger({
  level: 'debug', // Always log debug and above, regardless of environment
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
  ),
  defaultMeta: { service: 'streamlick-media' },
  transports: [
    // Always log to console for PM2 to capture
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // Also log to files for persistence
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.json()
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.json()
    }),
  ],
});

export default logger;
