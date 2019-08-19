const winston = require("winston");
const logger = winston.createLogger({
    format: winston.format.simple(),
    transports: [new winston.transports.Console()]
});
module.exports = {
    logger: logger
};
