import pino, { type Logger } from 'pino';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

let _logger: Logger | undefined;

export function initLogger(opts: { level: string; dest?: string }): Logger {
  const { level, dest } = opts;
  if (dest) {
    mkdirSync(dirname(dest), { recursive: true });
    _logger = pino(
      { level },
      pino.destination({ dest, sync: false, mkdir: true }),
    );
  } else {
    // 默认走 stderr; stdio 上的 stdout 已被 MCP 占用,不能用
    _logger = pino({ level }, pino.destination(2));
  }
  return _logger;
}

export function getLogger(): Logger {
  if (!_logger) {
    throw new Error('logger not initialized; call initLogger first');
  }
  return _logger;
}

/**
 * Init logger from mcp's env-driven config. Writes pino logs to
 * `<logDir>/mcp-<YYYY-MM-DD>.log`. Never writes to stdout (stdio is
 * reserved for MCP JSON-RPC).
 */
export function initLoggerFromEnv(opts: { logDir: string; level?: 'debug'|'info'|'warn'|'error' }): void {
  const date = new Date().toISOString().slice(0, 10);
  const file = join(opts.logDir, `mcp-${date}.log`);
  initLogger({ level: opts.level ?? 'info', dest: file });
}
