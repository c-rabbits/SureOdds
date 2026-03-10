const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');

// ============================================================
// 로그 포맷 정의
// ============================================================
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const svc = service ? `[${service}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level.toUpperCase().padEnd(5)} ${svc} ${message}${metaStr}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ============================================================
// 콘솔 출력 포맷 (컬러)
// ============================================================
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const svc = service ? `[${service}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${svc} ${message}${metaStr}`;
  })
);

// ============================================================
// Winston Logger 인스턴스 생성
// ============================================================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {},
  transports: [
    // 콘솔 출력
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // 전체 로그 (일별 로테이션, 14일 보관)
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'sureodds-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: logFormat,
    }),

    // 에러 전용 로그 (30일 보관)
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: jsonFormat,
    }),
  ],
});

// ============================================================
// 서비스별 자식 로거 생성 헬퍼
// ============================================================
function createServiceLogger(serviceName) {
  return logger.child({ service: serviceName });
}

// ============================================================
// Express 요청 로깅 미들웨어
// ============================================================
function requestLogger(req, res, next) {
  const start = Date.now();
  const reqLogger = createServiceLogger('HTTP');

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    reqLogger[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
    });
  });

  next();
}

module.exports = { logger, createServiceLogger, requestLogger };
