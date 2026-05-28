import { createCrawler, getAdapter, type Crawler, type CrawlerConfig } from 'bbs-crawler';

let instance: Crawler | null = null;
let initPromise: Promise<Crawler> | null = null;
let browserReady = false;

/**
 * Lazily start the single Crawler instance for this process.
 * Re-entrant: concurrent calls share the same in-flight promise; after
 * resolution, subsequent calls return the cached instance.
 */
export async function initCrawler(config: CrawlerConfig = {}): Promise<Crawler> {
  if (instance) return instance;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const c = await createCrawler(config);
    instance = c;
    initPromise = null;
    return c;
  })();
  return initPromise;
}

/** Synchronous accessor — throws if initCrawler has not resolved yet. */
export function getCrawler(): Crawler {
  if (!instance) throw new Error('crawler not initialized — call initCrawler() first');
  return instance;
}

/** Whether the warm-up cycle has completed successfully. */
export function getBrowserReady(): boolean { return browserReady; }

/**
 * Force browser launch + login verification. Run by server startup
 * (fire-and-forget) and by forum_login tool. Sets browserReady on success;
 * leaves it false and rethrows on failure (caller decides logging).
 */
export async function warmUpBrowser(siteKey: string): Promise<void> {
  const c = getCrawler();
  await c.withLoggedInPage(async (page) => {
    const ok = await getAdapter(siteKey).isLoggedIn(page);
    if (!ok) throw new Error('adapter.isLoggedIn returned false after ensureLoggedIn');
  });
  browserReady = true;
}

/** Shutdown + reset. Safe to call multiple times or before init. */
export async function shutdownCrawler(): Promise<void> {
  const c = instance;
  instance = null;
  initPromise = null;
  browserReady = false;
  if (c) await c.shutdown();
}

/** Test-only reset (does NOT call shutdown). */
export function _resetForTests(): void {
  instance = null;
  initPromise = null;
  browserReady = false;
}
