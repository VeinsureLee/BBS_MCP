import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseMcpConfig, type McpConfig } from './schema.js';

export class ConfigError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadMcpConfig(configPath: string): McpConfig {
  const abs = resolve(configPath);
  let raw: unknown;
  try {
    const text = readFileSync(abs, 'utf-8');
    raw = JSON.parse(text);
  } catch (e) {
    throw new ConfigError(`failed to read/parse config at ${abs}`, e);
  }
  try {
    return parseMcpConfig(raw);
  } catch (e) {
    throw new ConfigError(`config validation failed for ${abs}`, e);
  }
}

export function loadFromEnv(): McpConfig {
  const path = process.env.BBS_MCP_CONFIG;
  if (!path) {
    throw new ConfigError('BBS_MCP_CONFIG env var is required');
  }
  return loadMcpConfig(path);
}
