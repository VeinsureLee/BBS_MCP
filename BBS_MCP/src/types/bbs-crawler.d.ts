/**
 * Ambient module declaration for bbs-crawler.
 * The package is built without declaration:true, so we provide stubs here
 * until bbs-crawler is updated to emit .d.ts files.
 */
declare module 'bbs-crawler' {
  export class BaseAppError extends Error {}
  export class BoardNotFoundError extends BaseAppError {}
  export class SessionExpiredError extends BaseAppError {}
  export class RateLimitedError extends BaseAppError {}
  export class FetchFailedError extends BaseAppError {}
  export class MissingCredentialsError extends BaseAppError {}
  export class LoginFailedError extends BaseAppError {}
  export class NavigationTimeoutError extends BaseAppError {}
  export class DatabaseError extends BaseAppError {}
  export class SelectorMissingError extends BaseAppError {}
  export class UnknownSiteError extends BaseAppError {}
}
