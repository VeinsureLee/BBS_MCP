import { describe, it, expect } from 'vitest';
import { loadMcpConfigFromEnv, ConfigError } from '../../src/config/load';

describe('loadMcpConfigFromEnv', () => {
  it('defaults logDir to .logs/mcp, graphEnabled to false', () => {
    const c = loadMcpConfigFromEnv({});
    expect(c.logDir).toBe('.logs/mcp');
    expect(c.graphEnabled).toBe(false);
  });
  it('reads BBS_MCP_LOG_DIR', () => {
    expect(loadMcpConfigFromEnv({ BBS_MCP_LOG_DIR: '/tmp/mcp-logs' }).logDir).toBe('/tmp/mcp-logs');
  });
  it('reads BBS_MCP_GRAPH_ENABLED only on exact "true"', () => {
    expect(loadMcpConfigFromEnv({ BBS_MCP_GRAPH_ENABLED: 'true' }).graphEnabled).toBe(true);
    expect(loadMcpConfigFromEnv({ BBS_MCP_GRAPH_ENABLED: 'false' }).graphEnabled).toBe(false);
    expect(loadMcpConfigFromEnv({ BBS_MCP_GRAPH_ENABLED: '1' }).graphEnabled).toBe(false);
  });
  it('ignores crawler env (DATABASE_PATH, SCHOOL_BBS_USERNAME etc.)', () => {
    const c = loadMcpConfigFromEnv({ DATABASE_PATH: '/x', SCHOOL_BBS_USERNAME: 'u' });
    expect(Object.keys(c).sort()).toEqual(['graphEnabled', 'logDir']);
  });
  it('ConfigError is exported for consumers to catch', () => {
    expect(typeof ConfigError).toBe('function');
  });
});
