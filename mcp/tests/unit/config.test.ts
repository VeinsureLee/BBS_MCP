import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { parseMcpConfig } from '../../src/config/schema.js';
import { loadMcpConfig, ConfigError } from '../../src/config/load.js';

describe('parseMcpConfig', () => {
  it('parses a minimal valid config', () => {
    const cfg = parseMcpConfig({
      data_dir: 'D:/data',
      crawler: { site_key: 'school-bbs' },
    });
    expect(cfg.data_dir).toBe('D:/data');
    expect(cfg.crawler.site_key).toBe('school-bbs');
    expect(cfg.graph.enabled).toBe('auto');
    expect(cfg.logging.level).toBe('info');
  });

  it('respects graph.enabled when set explicitly', () => {
    const cfg = parseMcpConfig({
      data_dir: 'D:/data',
      crawler: { site_key: 'school-bbs' },
      graph: { enabled: false },
    });
    expect(cfg.graph.enabled).toBe(false);
  });

  it('rejects config without data_dir', () => {
    expect(() => parseMcpConfig({
      crawler: { site_key: 'school-bbs' },
    } as unknown)).toThrow();
  });

  it('rejects unknown graph.enabled value', () => {
    expect(() => parseMcpConfig({
      data_dir: 'D:/data',
      crawler: { site_key: 'school-bbs' },
      graph: { enabled: 'maybe' },
    } as unknown)).toThrow();
  });
});

describe('loadMcpConfig path resolution', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'bbs-mcp-cfg-'));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves relative data_dir against the config file directory, not cwd', () => {
    const cfgPath = join(tmpDir, 'bbs-mcp.config.json');
    writeFileSync(cfgPath, JSON.stringify({
      data_dir: './BBS_Crawler/data/crawler.db',
      crawler: { site_key: 'school-bbs' },
      logging: { file: './logs/bbs-mcp.log' },
    }));
    const cfg = loadMcpConfig(cfgPath);
    expect(isAbsolute(cfg.data_dir)).toBe(true);
    expect(cfg.data_dir).toBe(join(tmpDir, 'BBS_Crawler', 'data', 'crawler.db'));
    expect(cfg.logging.file).toBe(join(tmpDir, 'logs', 'bbs-mcp.log'));
  });

  it('leaves absolute paths untouched', () => {
    const cfgPath = join(tmpDir, 'bbs-mcp.config.json');
    const abs = process.platform === 'win32' ? 'D:/elsewhere/data' : '/elsewhere/data';
    writeFileSync(cfgPath, JSON.stringify({
      data_dir: abs,
      crawler: { site_key: 'school-bbs' },
    }));
    const cfg = loadMcpConfig(cfgPath);
    expect(cfg.data_dir).toBe(abs);
  });

  it('throws ConfigError on bad JSON', () => {
    const cfgPath = join(tmpDir, 'bbs-mcp.config.json');
    writeFileSync(cfgPath, '{ not json ]');
    expect(() => loadMcpConfig(cfgPath)).toThrow(ConfigError);
  });
});
