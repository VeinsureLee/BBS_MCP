/**
 * MCP-side error_code mapping for crawler-domain errors.
 *
 * Decoupled from `bbs-crawler` at the module level: we duck-type on `err.name`
 * instead of `instanceof CrawlerError`, so loading this module never triggers
 * resolution of `bbs-crawler`'s compiled output. This unblocks `node dist/server.js`
 * for M0-M2 (read-only tools that never actually need the crawler at runtime).
 *
 * Safe because `bbs-crawler`'s `BaseAppError` sets `this.name = new.target.name`
 * in its constructor, so every subclass has `.name === 'BoardNotFoundError'` etc.
 *
 * Task 17 will revisit this when wiring CrawlerService for real, alongside the
 * underlying crawler ESM-import fix.
 */

export type McpErrorCode =
  | 'crawler.login_required'
  | 'crawler.rate_limited'
  | 'crawler.board_not_found'
  | 'crawler.timeout'
  | 'crawler.fetch_failed'
  | 'crawler.database'
  | 'graph.not_enabled'
  | 'mcp.config_error'
  | 'mcp.invalid_input'
  | 'mcp.internal';

const CRAWLER_ERROR_NAME_MAP: Record<string, McpErrorCode> = {
  BoardNotFoundError: 'crawler.board_not_found',
  SessionExpiredError: 'crawler.login_required',
  MissingCredentialsError: 'crawler.login_required',
  LoginFailedError: 'crawler.login_required',
  RateLimitedError: 'crawler.rate_limited',
  NavigationTimeoutError: 'crawler.timeout',
  FetchFailedError: 'crawler.fetch_failed',
  DatabaseError: 'crawler.database',
};

export class McpToolError extends Error {
  constructor(
    public error_code: McpErrorCode,
    message: string,
    public original?: unknown,
  ) {
    super(message);
    this.name = 'McpToolError';
  }
}

export function toMcpError(err: unknown): McpToolError {
  if (err instanceof McpToolError) return err;

  if (err instanceof Error) {
    const code = CRAWLER_ERROR_NAME_MAP[err.name];
    if (code) return new McpToolError(code, err.message, err);
    return new McpToolError('mcp.internal', err.message, err);
  }

  return new McpToolError('mcp.internal', String(err), err);
}
