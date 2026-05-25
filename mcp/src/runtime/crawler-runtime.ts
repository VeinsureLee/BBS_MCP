/**
 * Adapter / lazy initializer for the bbs-crawler library. Pulled behind an
 * interface so tests can inject a fake without spinning up Playwright.
 */

export interface CrawlBoardInput {
  board_node_id: number;
  mode: 'recent' | 'deep';
  max_pages?: number;
}

export interface CrawlBoardOutput {
  threads_seen: number;
  threads_new: number;
  elapsed_s?: number;
  errors?: string[];
}

export interface CrawlThreadInput {
  thread_url: string;
  force?: boolean;
}

export interface CrawlThreadOutput {
  thread_id: number;
  fetched: boolean;
  skipped: boolean;
  reason?: string;
}

export interface CrawlerLike {
  crawlBoard(input: CrawlBoardInput): Promise<CrawlBoardOutput>;
  crawlThread(input: CrawlThreadInput): Promise<CrawlThreadOutput>;
  isLoggedIn(): Promise<boolean>;
  sessionExpiresAt(): Promise<string | null>;
  shutdown(): Promise<void>;
}

export type CrawlerFactory = (opts: { siteKey: string; dataDir: string }) => Promise<CrawlerLike>;

export interface CrawlerRuntimeOptions {
  siteKey: string;
  dataDir: string;
  factory: CrawlerFactory;
}

export class CrawlerRuntime {
  private service: CrawlerLike | undefined;

  constructor(private opts: CrawlerRuntimeOptions) {}

  private async ensure(): Promise<CrawlerLike> {
    if (!this.service) {
      this.service = await this.opts.factory({
        siteKey: this.opts.siteKey,
        dataDir: this.opts.dataDir,
      });
    }
    return this.service;
  }

  async crawlBoard(input: CrawlBoardInput): Promise<CrawlBoardOutput> {
    const s = await this.ensure();
    const start = Date.now();
    const r = await s.crawlBoard(input);
    return { ...r, elapsed_s: (Date.now() - start) / 1000 };
  }

  async crawlThread(input: CrawlThreadInput): Promise<CrawlThreadOutput> {
    const s = await this.ensure();
    return s.crawlThread(input);
  }

  async isLoggedIn(): Promise<boolean> {
    if (!this.service) return false;
    return this.service.isLoggedIn();
  }

  async sessionExpiresAt(): Promise<string | null> {
    if (!this.service) return null;
    return this.service.sessionExpiresAt();
  }

  async shutdown(): Promise<void> {
    if (this.service) {
      await this.service.shutdown();
      this.service = undefined;
    }
  }
}

/**
 * Real factory — instantiates bbs-crawler with full Playwright infrastructure.
 *
 * ASSUMPTION NOTES (verified against BBS_Crawler/src/ on 2026-05-24):
 *
 * 1. CrawlerService constructor takes CrawlerServiceDeps, NOT { adapter, appConfig, siteKey }.
 *    The plan's guess was wrong. The real deps require: rateLimiter, browserPool, auth,
 *    registry, persistThread, appendFetchLog, and optionally sleep/initOrchestrator.
 *    We assemble all of these here from the exported helpers.
 *
 * 2. No crawlBoard() method on CrawlerService. The plan's guess was wrong.
 *    The closest method is listThreadsByName({ siteKey, boardName, mode, pages }).
 *    We translate CrawlBoardInput.board_node_id → boardName via getBoardById().
 *    mode: 'recent' → 'incremental', mode: 'deep' → 'pages'.
 *    CrawlBoardOutput.threads_seen counts collected threads (no separate "seen" counter
 *    in the real API — we use collected.length for both seen and new as approximation).
 *
 * 3. No crawlThread() on CrawlerService. The real method is fetchThread({ siteKey, url, persist }).
 *    Plan used fetchThread({ url, force }) — force is not a real param; we drop it.
 *    FetchThreadOutput has { thread, persisted, threadId } — no fetched/skipped flags.
 *    We synthesize fetched=true / skipped=false from a successful call.
 *
 * 4. getAdapter() throws UnknownSiteError (not returns null). Plan's null-check is wrong.
 *    We use try/catch instead and let the error propagate naturally.
 *
 * 5. initDb() is SYNCHRONOUS (returns SQLiteDb directly). Plan's await is harmless
 *    (await on a non-Promise is a no-op) but noted for clarity.
 *
 * 6. No authManager property on CrawlerService. Auth state is internal to the deps
 *    (AuthManager instance injected into browserPool/auth deps).
 *    isLoggedIn() and sessionExpiresAt() cannot be read from CrawlerService directly.
 *    We return false/null as safe defaults — Task 19 (forum_status) will need a
 *    separate mechanism if real auth status is required.
 *
 * 7. BrowserPool and AuthManager require full construction (headless browser, storage
 *    state dirs, rate limiter). This is production wiring — tests use fake factory.
 *
 * 8. persistThread in CrawlerServiceDeps: the crawler exports upsertThread from
 *    repository/threads.js. We wire it as the persistThread dep.
 *
 * 9. getBoardById() is ASYNC (returns Promise<BoardRow | null>). Plan had it right.
 *
 * 10. listThreadsByName returns { threads, nextCursor, state } — not { threadsSeen, threadsNew }.
 *     We use threads.length as threads_seen. threads_new cannot be determined without
 *     pre-crawl state comparison; we report 0 for now (Task 18 can improve this).
 */
export const realCrawlerFactory: CrawlerFactory = async ({ siteKey, dataDir }) => {
  // bbs-crawler is an ESM peer dependency; its dist/ is built separately from
  // the source tree. tsc cannot resolve types until the package is built, so
  // we suppress the module-not-found diagnostic and treat the import as `any`.
  // At runtime the package is always present (workspace symlink → BBS_Crawler/dist/).
  // @ts-ignore -- TS2307: bbs-crawler types require a `npm run build` in BBS_Crawler first
  const crawler: any = await import('bbs-crawler');

  // Load BBS_Crawler/.env so BROWSER_EXECUTABLE_PATH, STORAGE_STATE_DIR,
  // SCHOOL_BBS_* credentials etc. flow into process.env before we call
  // crawler.parseConfig. The crawler's own CLI scripts do this via top-level
  // `import 'dotenv/config'`; we replicate that here so MCP-launched crawls
  // see the same env the crawler-CLI scripts see.
  try {
    const { createRequire } = await import('node:module');
    const dotenv = await import('dotenv');
    const requireFromHere = createRequire(import.meta.url);
    const crawlerPkgPath = requireFromHere.resolve('bbs-crawler/package.json');
    const crawlerRoot = (await import('node:path')).dirname(crawlerPkgPath);
    dotenv.config({ path: `${crawlerRoot}/.env` });
  } catch {
    // .env is optional — if missing or unreadable, fall through with whatever
    // env vars the launching shell already provided.
  }

  // Now parse the (possibly enriched) env into AppConfig so we honor user
  // browser/headless/rate settings instead of hardcoding them.
  const appConfig = crawler.parseConfig({ ...process.env, DATABASE_PATH: dataDir });

  // initDb is synchronous — await is harmless but kept for consistency with plan.
  crawler.initDb({ dataDir: appConfig.dataDir });

  // Build infrastructure deps from appConfig.
  const rateLimiter = crawler.createRateLimiter({
    minIntervalMs: appConfig.rateMinIntervalMs,
    jitterMs: appConfig.rateJitterMs,
    maxConcurrency: appConfig.rateMaxConcurrency,
  });

  const browserPool = new crawler.BrowserPool({
    headless: appConfig.browserHeadless,
    executablePath: appConfig.browserExecutablePath,
    userAgent: appConfig.browserUserAgent,
    storageStateDir: appConfig.storageStateDir,
    idleTimeoutMs: appConfig.idleTimeoutMs,
  });

  const authManager = new crawler.AuthManager({
    env: process.env,
    saveStorageState: (sk: string) => browserPool.acquire(sk).then((a: any) => {
      a.saveStorageState();
      a.release();
    }),
    addRedactedSecret: crawler.addRedactedSecret,
  });

  const service = new crawler.CrawlerService({
    rateLimiter,
    browserPool,
    auth: {
      ensureLoggedIn: (page: unknown, adapter: unknown) =>
        (authManager as any).ensureLoggedIn(page, adapter),
      detectSessionExpired: (page: unknown, adapter: unknown) =>
        (authManager as any).detectSessionExpired(page, adapter),
    },
    registry: {
      getAdapter: (sk: string) => crawler.getAdapter(sk),
    },
    persistThread: async (sk: string, thread: unknown) => {
      // upsertThread requires opts: { isPinned: boolean } and returns
      // { threadId, boardDb } — NOT { id }. Default isPinned=false here;
      // pinned vs plain distinction is conveyed by the crawler's own
      // upsertPinnedThread vs upsertPlainThread paths upstream — when
      // CrawlerService calls persistThread it has already decided.
      // Task 18 may refine this if pinned routing is needed at this layer.
      const result = await (crawler as any).upsertThread(sk, thread, { isPinned: false });
      return result?.threadId ?? 0;
    },
    appendFetchLog: (row: unknown) => (crawler as any).appendFetchLog(row),
  });

  return {
    async crawlBoard(input: CrawlBoardInput): Promise<CrawlBoardOutput> {
      // Translate board_node_id → board display name via getBoardById.
      const board = await crawler.getBoardById(input.board_node_id);
      if (!board) {
        throw new crawler.BoardNotFoundError(`board_node_id=${input.board_node_id}`);
      }

      // Map our mode to crawler mode: 'recent' → incremental, 'deep' → pages.
      const crawlerMode = input.mode === 'deep' ? 'pages' : 'incremental';
      const crawlerInput: Record<string, unknown> = {
        siteKey,
        boardName: board.name,
        mode: crawlerMode,
      };
      if (input.max_pages !== undefined) crawlerInput.pages = input.max_pages;

      const result = await service.listThreadsByName(
        crawlerInput as Parameters<typeof service.listThreadsByName>[0],
      );

      // listThreadsByName returns { threads, nextCursor, state }.
      // threads_new is not directly available; use threads.length as seen count.
      // threads_new is approximated as 0 — Task 18 can improve with pre/post comparison.
      return {
        threads_seen: result.threads.length,
        threads_new: 0,
      };
    },

    async crawlThread(input: CrawlThreadInput): Promise<CrawlThreadOutput> {
      // fetchThread({ siteKey, url, persist }) — no 'force' param in real API.
      const result = await service.fetchThread({
        siteKey,
        url: input.thread_url,
        persist: true,
      });
      return {
        thread_id: result.threadId ?? 0,
        fetched: result.persisted,
        skipped: false,
      };
    },

    async isLoggedIn(): Promise<boolean> {
      // AuthManager has no public isLoggedIn(); it's checked per-page via adapter.
      // Return false as a safe default — Task 19 can wire real session checking.
      return false;
    },

    async sessionExpiresAt(): Promise<string | null> {
      // No sessionExpiresAt on AuthManager or CrawlerService. Return null.
      return null;
    },

    async shutdown(): Promise<void> {
      await crawler.closeAllDbs();
      // BrowserPool has no explicit shutdown in the public API — idle timeout handles cleanup.
    },
  };
};
