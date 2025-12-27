const pino = require('pino');

function createLogger(level = 'info') {
  return pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: undefined,
  });
}

module.exports = createLogger;
