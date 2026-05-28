import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import { getAdapter, type Crawler } from 'bbs-crawler';
import { setBrowserReady } from '../../runtime/crawler.js';

export interface LoginContext { crawler: Crawler; siteKey: string; }

let loginInflight: Promise<unknown> | null = null;

/**
 * Process-level login mutex. Serializes all forum_login calls.
 *
 * Implementation: tail-chain. `loginInflight` is updated synchronously to the
 * tail of the chain BEFORE returning, so every subsequent caller observes the
 * latest tail (not a stale earlier one) and queues after it. Errors are
 * swallowed in the tail tracker so a rejection doesn't poison later callers.
 */
function withLoginMutex<T>(fn: () => Promise<T>): Promise<T> {
  const result = (loginInflight ?? Promise.resolve()).then(() => fn());
  loginInflight = result.then(() => {}, () => {});
  return result;
}

async function readStateMtime(siteKey: string): Promise<number | null> {
  const dir = process.env.STORAGE_STATE_DIR || './.state';
  const file = path.join(dir, `${siteKey}.json`);
  try {
    const st = await fs.stat(file);
    return st.mtimeMs;
  } catch {
    return null;
  }
}

export const loginTool = {
  name: 'forum_login',
  description: 'Trigger login (or verify existing session). If storageState is valid → source="existing_state". Otherwise → source="fresh_login" via .env credentials. Process-level mutex prevents concurrent logins.',
  inputSchema: z.object({}),
  async handler(_input: Record<string, never>, ctx: LoginContext) {
    return withLoginMutex(async () => {
      const before = await readStateMtime(ctx.siteKey);
      let loggedIn = false;
      await ctx.crawler.withLoggedInPage(async (page) => {
        loggedIn = await getAdapter(ctx.siteKey).isLoggedIn(page);
      });
      if (loggedIn) setBrowserReady(true);
      const after = await readStateMtime(ctx.siteKey);
      const source: 'existing_state' | 'fresh_login' =
        after !== null && (before === null || after > before) ? 'fresh_login' : 'existing_state';
      return {
        logged_in: loggedIn,
        username: process.env.SCHOOL_BBS_USERNAME ?? null,
        source,
      };
    });
  },
};
