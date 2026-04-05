/**
 * 로거 유틸리티
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const levels: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = levels[LOG_LEVEL] ?? 2;

function formatMessage(level: string, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

const logger = {
  error(message: string, meta?: any) {
    if (currentLevel >= levels.error) {
      console.error(formatMessage('error', message, meta));
    }
  },
  warn(message: string, meta?: any) {
    if (currentLevel >= levels.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  info(message: string, meta?: any) {
    if (currentLevel >= levels.info) {
      console.log(formatMessage('info', message, meta));
    }
  },
  debug(message: string, meta?: any) {
    if (currentLevel >= levels.debug) {
      console.log(formatMessage('debug', message, meta));
    }
  },
  http(message: string, meta?: any) {
    if (currentLevel >= levels.info) {
      console.log(formatMessage('http', message, meta));
    }
  },
  log(level: string, message: string, meta?: any) {
    const numLevel = levels[level] ?? 2;
    if (currentLevel >= numLevel) {
      console.log(formatMessage(level, message, meta));
    }
  },
};

export default logger;
