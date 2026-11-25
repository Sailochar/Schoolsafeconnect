/**
 * Structured Logger using Winston
 */

const winston = require("winston");
const config = require("../config/env");

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: "blue"
  }
};

winston.addColors(customLevels.colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.errors({ stack: true }),
  config.IS_PRODUCTION
    ? winston.format.json()
    : winston.format.printf(
      (info) => `[${info.timestamp}] [${info.level.toUpperCase()}]: ${info.message}${info.stack ? "\n" + info.stack : ""}`
    )
);

const transports = [
  new winston.transports.Console({
    format: config.IS_PRODUCTION ? winston.format.json() : winston.format.colorize({ all: true })
  })
];

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  levels: customLevels.levels,
  format,
  transports,
  exitOnError: false
});

module.exports = logger;
