const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }), // Captures stack traces for errors
    format.splat(),
    format.json() // Production standard: JSON for easy parsing
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    // Write all logs with importance level of 'error' or less to 'error.log'
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Write all logs with importance level of 'info' or less to 'combined.log'
    new transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production, log to the console with colors and simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.simple()
    ),
  }));
}

module.exports = logger;