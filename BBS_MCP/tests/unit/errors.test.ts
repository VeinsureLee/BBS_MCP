import { describe, it, expect } from 'vitest';
import { toMcpError, McpToolError } from '../../src/errors.js';
import {
  BoardNotFoundError,
  SessionExpiredError,
  RateLimitedError,
  FetchFailedError,
} from 'bbs-crawler';

describe('toMcpError', () => {
  it('maps BoardNotFoundError to crawler.board_not_found', () => {
    const err = toMcpError(new BoardNotFoundError('xyz'));
    expect(err.error_code).toBe('crawler.board_not_found');
  });

  it('maps SessionExpiredError to crawler.login_required', () => {
    const err = toMcpError(new SessionExpiredError('expired'));
    expect(err.error_code).toBe('crawler.login_required');
  });

  it('maps RateLimitedError to crawler.rate_limited', () => {
    const err = toMcpError(new RateLimitedError('429'));
    expect(err.error_code).toBe('crawler.rate_limited');
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
});
