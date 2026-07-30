/**
 * @marketforge/logger — pino structured logger factory + AI cost/token logging.
 *
 *   import { createLogger, logAiRun } from '@marketforge/logger';
 *   const log = createLogger({ service: 'api', org_id });
 *   log.info({ route: '/brands' }, 'handled request');
 */
import { pino, type Logger, type LoggerOptions } from 'pino';
import { env } from '@marketforge/config';

/** Structured context attached to every log line from a logger instance. */
export interface LogContext {
  /** Logical service/app name (api, worker, n8n-bridge, ...). */
  service?: string;
  /** Tenant + brand for correlation (never PII). */
  org_id?: string;
  brand_id?: string;
  /** Correlation/trace ids. */
  request_id?: string;
  job_id?: string;
  workflow?: string;
  [key: string]: unknown;
}

export type { Logger };

function baseOptions(): LoggerOptions {
  const options: LoggerOptions = {
    level: env.LOG_LEVEL,
    // Redact common secret-bearing fields defensively.
    redact: {
      paths: [
        'password',
        '*.password',
        'authorization',
        '*.authorization',
        'apiKey',
        '*.apiKey',
        'api_key',
        '*.api_key',
        'token',
        '*.token',
        'secret',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
    base: { env: env.APP_ENV },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (env.LOG_PRETTY && !env.isProd) {
    options.transport = {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    };
  }

  return options;
}

// Root logger — child loggers inherit its config + transport.
const rootLogger: Logger = pino(baseOptions());

/**
 * Create a child logger bound to a context. Cheap; call per request/job.
 */
export function createLogger(context: LogContext = {}): Logger {
  return rootLogger.child(context);
}

/**
 * Structured record for a single AI/agent run. Mandated by the platform's
 * "every AI call is logged" rule (CLAUDE.md hard constraint + ADR-009).
 */
export interface AiRunLog {
  workflow: string;
  agent: string;
  model: string;
  provider?: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
  retries: number;
  org_id: string;
  brand_id?: string;
  campaign_id?: string;
  content_item_id?: string;
  /** Version of the produced output (for regen/versioning). */
  output_version?: number;
  /** Non-fatal outcome flag. */
  status?: 'ok' | 'fallback' | 'error';
  error?: string;
}

/**
 * Emit a normalized AI-cost/token log line. Uses `info` for ok/fallback and
 * `error` for failures, always tagged `event: 'ai_run'` for downstream metrics.
 */
export function logAiRun(logger: Logger, record: AiRunLog): void {
  const payload = { event: 'ai_run' as const, ...record };
  if (record.status === 'error') {
    logger.error(payload, 'ai_run failed');
  } else {
    logger.info(payload, 'ai_run');
  }
}

/** The shared root logger (prefer createLogger for scoped context). */
export { rootLogger };
