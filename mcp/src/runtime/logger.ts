import pino, { type Logger } from 'pino';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { McpConfig } from '../config/schema.js';

let _logger: Logger | undefined;

export function initLogger(cfg: McpConfig): Logger {
  const level = cfg.logging.level;
  const dest = cfg.logging.file;
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
 *
 * Post-refactor entry point (server.ts will call this once Task 15 lands).
 * Internally builds a minimal legacy-shape config and calls initLogger so
 * we don't duplicate the pino setup.
 */
export function initLoggerFromEnv(opts: { logDir: string; level?: 'debug'|'info'|'warn'|'error' }): void {
  const date = new Date().toISOString().slice(0, 10);
  const file = join(opts.logDir, `mcp-${date}.log`);
  // Build the minimum shape initLogger accepts; cast as never to avoid
  // depending on the full McpConfig type here (Task 16 will collapse the
  // legacy shape entirely and we'll simplify this then).
  initLogger({ logging: { level: opts.level ?? 'info', file } } as never);
}
