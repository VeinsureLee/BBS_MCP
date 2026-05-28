import { createCrawler, type Crawler, type CrawlerConfig } from 'bbs-crawler';

let instance: Crawler | null = null;
let initPromise: Promise<Crawler> | null = null;

/**
 * Lazily start the single Crawler instance for this process.
 * Re-entrant: concurrent calls share the same in-flight promise; after
 * resolution, subsequent calls return the cached instance without
 * re-invoking createCrawler.
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

/** Shutdown + reset. Safe to call multiple times or before init. */
export async function shutdownCrawler(): Promise<void> {
  const c = instance;
  instance = null;
  initPromise = null;
  if (c) await c.shutdown();
}

/** Test-only reset (does NOT call shutdown). */
export function _resetForTests(): void {
  instance = null;
  initPromise = null;
}
