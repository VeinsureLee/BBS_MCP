import {
  BoardNotFoundError,
  SessionExpiredError,
  RateLimitedError,
  FetchFailedError,
  MissingCredentialsError,
  LoginFailedError,
  NavigationTimeoutError,
  DatabaseError,
} from 'bbs-crawler';

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

  const msg = err instanceof Error ? err.message : String(err);

  if (err instanceof BoardNotFoundError) {
    return new McpToolError('crawler.board_not_found', msg, err);
  }
  if (err instanceof SessionExpiredError || err instanceof MissingCredentialsError || err instanceof LoginFailedError) {
    return new McpToolError('crawler.login_required', msg, err);
  }
  if (err instanceof RateLimitedError) {
    return new McpToolError('crawler.rate_limited', msg, err);
  }
  if (err instanceof NavigationTimeoutError) {
    return new McpToolError('crawler.timeout', msg, err);
  }
  if (err instanceof FetchFailedError) {
    return new McpToolError('crawler.fetch_failed', msg, err);
  }
  if (err instanceof DatabaseError) {
    return new McpToolError('crawler.database', msg, err);
  }

  return new McpToolError('mcp.internal', msg, err);
}
