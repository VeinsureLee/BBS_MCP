import { describe, it, expect } from 'vitest';
import { toMcpError, McpToolError } from '../../src/errors.js';

/**
 * Tests use locally-defined fake error classes that mimic bbs-crawler's
 * naming convention (`this.name = '<ClassName>'`). This keeps the test
 * decoupled from bbs-crawler at module level and verifies the public
 * duck-typing contract of toMcpError directly.
 */
class FakeBoardNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoardNotFoundError';
  }
}

class FakeSessionExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

class FakeRateLimitedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitedError';
  }
}

describe('toMcpError', () => {
  it('maps BoardNotFoundError to crawler.board_not_found', () => {
    const err = toMcpError(new FakeBoardNotFoundError('xyz'));
    expect(err.error_code).toBe('crawler.board_not_found');
  });

  it('maps SessionExpiredError to crawler.login_required', () => {
    const err = toMcpError(new FakeSessionExpiredError('expired'));
    expect(err.error_code).toBe('crawler.login_required');
  });

  it('maps RateLimitedError to crawler.rate_limited', () => {
    const err = toMcpError(new FakeRateLimitedError('429'));
    expect(err.error_code).toBe('crawler.rate_limited');
  });

  it('maps DatabaseError to crawler.database', () => {
    const err = new Error('boom');
    (err as any).name = 'DatabaseError';
    const m = toMcpError(err);
    expect(m.error_code).toBe('crawler.database');
    expect(m.message).toBe('boom');
  });

  it('falls back to mcp.internal for unknown errors', () => {
    const err = toMcpError(new Error('something'));
    expect(err.error_code).toBe('mcp.internal');
  });

  it('preserves message and original error', () => {
    const orig = new Error('boom');
    const err = toMcpError(orig);
    expect(err.message).toContain('boom');
    expect(err.original).toBe(orig);
  });

  it('returns existing McpToolError unchanged (pass-through)', () => {
    const existing = new McpToolError('crawler.timeout', 'preset');
    const err = toMcpError(existing);
    expect(err).toBe(existing);
  });
});
