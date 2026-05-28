import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

vi.mock('bbs-crawler', () => ({
  getAdapter: vi.fn(() => ({ isLoggedIn: vi.fn(async () => true) })),
}));

import { loginTool } from '../../../src/tools/auth/login';

const tmpDirs: string[] = [];
function mkTmp(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'login-'));
  tmpDirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
  }
});

const ENV_BACKUP = { ...process.env };
afterEach(() => { process.env = { ...ENV_BACKUP }; });

function mockCtx(opts: { stateMtime?: number | null; isLoggedInResult?: boolean; throwInWith?: Error } = {}) {
  process.env.STORAGE_STATE_DIR = mkTmp();
  if (opts.stateMtime !== undefined && opts.stateMtime !== null) {
    fs.writeFileSync(path.join(process.env.STORAGE_STATE_DIR, 'school-bbs.json'), '{}');
    fs.utimesSync(path.join(process.env.STORAGE_STATE_DIR, 'school-bbs.json'), opts.stateMtime / 1000, opts.stateMtime / 1000);
  }
  process.env.SCHOOL_BBS_USERNAME = 'alice';
  const withLoggedInPage = vi.fn(async (fn: any) => {
    if (opts.throwInWith) throw opts.throwInWith;
    return fn({} as any);
  });
  return {
    crawler: { withLoggedInPage } as any,
    siteKey: 'school-bbs',
  };
}

describe('loginTool', () => {
  beforeEach(async () => {
    const { getAdapter } = await import('bbs-crawler');
    (getAdapter as any).mockReturnValue({ isLoggedIn: vi.fn(async () => true) });
  });

  it('returns existing_state when storageState file is unchanged after ensureLoggedIn', async () => {
    const ctx = mockCtx({ stateMtime: Date.now() - 5000 });
    const out = await loginTool.handler({}, ctx);
    expect(out.logged_in).toBe(true);
    expect(out.username).toBe('alice');
    expect(out.source).toBe('existing_state');
  });

  it('returns fresh_login when no prior state file exists', async () => {
    const ctx = mockCtx({});
    (ctx.crawler.withLoggedInPage as any).mockImplementation(async (fn: any) => {
      fs.writeFileSync(path.join(process.env.STORAGE_STATE_DIR!, 'school-bbs.json'), '{}');
      return fn({} as any);
    });
    const out = await loginTool.handler({}, ctx);
    expect(out.source).toBe('fresh_login');
    expect(out.logged_in).toBe(true);
  });

  it('returns fresh_login when state file mtime increased', async () => {
    const oldMtime = Date.now() - 60000;
    const ctx = mockCtx({ stateMtime: oldMtime });
    (ctx.crawler.withLoggedInPage as any).mockImplementation(async (fn: any) => {
      const file = path.join(process.env.STORAGE_STATE_DIR!, 'school-bbs.json');
      fs.utimesSync(file, Date.now() / 1000, Date.now() / 1000);
      return fn({} as any);
    });
    const out = await loginTool.handler({}, ctx);
    expect(out.source).toBe('fresh_login');
  });

  it('rethrows when withLoggedInPage throws (credentials missing etc.)', async () => {
    const err = new Error('MissingCredentialsError');
    (err as any).name = 'MissingCredentialsError';
    const ctx = mockCtx({ throwInWith: err });
    await expect(loginTool.handler({}, ctx)).rejects.toThrow(/MissingCredentialsError/);
  });

  it('serializes concurrent calls via login mutex', async () => {
    const ctx = mockCtx({ stateMtime: Date.now() });
    let inFlight = 0; let maxInFlight = 0;
    (ctx.crawler.withLoggedInPage as any).mockImplementation(async (fn: any) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 30));
      inFlight--;
      return fn({} as any);
    });
    await Promise.all([loginTool.handler({}, ctx), loginTool.handler({}, ctx)]);
    expect(maxInFlight).toBe(1);
  });

  it('serializes 3+ concurrent calls (maxInFlight stays 1)', async () => {
    const ctx = mockCtx({ stateMtime: Date.now() });
    let inFlight = 0; let maxInFlight = 0;
    (ctx.crawler.withLoggedInPage as any).mockImplementation(async (fn: any) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      return fn({} as any);
    });
    await Promise.all([
      loginTool.handler({}, ctx),
      loginTool.handler({}, ctx),
      loginTool.handler({}, ctx),
    ]);
    expect(maxInFlight).toBe(1);
  });

  it('username is null when SCHOOL_BBS_USERNAME unset', async () => {
    const ctx = mockCtx({ stateMtime: Date.now() });
    delete process.env.SCHOOL_BBS_USERNAME;
    const out = await loginTool.handler({}, ctx);
    expect(out.username).toBeNull();
  });
});
