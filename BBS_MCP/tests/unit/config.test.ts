import { describe, it, expect } from 'vitest';
import { parseMcpConfig } from '../../src/config/schema.js';

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
