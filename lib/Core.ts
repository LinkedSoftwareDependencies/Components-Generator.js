import * as winston from 'winston';

/**
 * Exposes a logger that can be used by all other classes
 */
export const logger = winston.createLogger({
  format: winston.format.simple(),
  transports: [ new winston.transports.Console() ],
});
