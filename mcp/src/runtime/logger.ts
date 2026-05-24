import pino, { type Logger } from 'pino';
import { dirname } from 'node:path';
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
