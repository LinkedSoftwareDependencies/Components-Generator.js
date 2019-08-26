import * as  winston from "winston";

const logger = winston.createLogger({
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
});
export { logger };

