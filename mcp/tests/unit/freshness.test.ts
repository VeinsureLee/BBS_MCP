import { describe, it, expect, vi } from 'vitest';
import { buildFreshness } from '../../src/runtime/freshness.js';

describe('buildFreshness', () => {
  it('always includes as_of ISO timestamp', () => {
    const f = buildFreshness({});
    expect(f.as_of).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes board_last_crawled_at when provided', () => {
    const f = buildFreshness({ board_last_crawled_at: '2026-05-24T10:00:00Z' });
    expect(f.board_last_crawled_at).toBe('2026-05-24T10:00:00Z');
  });

  it('derives threads_in_result_newest from threads array', () => {
    const f = buildFreshness({
      threads: [
        { posted_at: '2026-05-20T10:00:00Z' },
        { posted_at: '2026-05-22T10:00:00Z' },
        { posted_at: '2026-05-21T10:00:00Z' },
      ],
    });
    expect(f.threads_in_result_newest).toBe('2026-05-22T10:00:00Z');
  });

  it('does not include graph_last_synced_at when graphEnabled=false', () => {
    const f = buildFreshness({ graphEnabled: false });
    expect(f.graph_last_synced_at).toBeUndefined();
  });
});
