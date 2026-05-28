import { describe, it, expect } from 'vitest';
import { searchLocalTool } from '../../../src/tools/read/search-local';

function mock(readers: Partial<any>) {
  return { crawler: { readers } } as any;
}

describe('searchLocalTool', () => {
  it('forwards (site_key, keyword, limit) to readers.searchThreadsByTitle', async () => {
    const captured: any[] = [];
    const ctx = mock({
      searchThreadsByTitle: async (...args: any[]) => {
        captured.push(args);
        return [{ id: 1 } as any];
      },
    });
    const out = await searchLocalTool.handler(
      { site_key: 's', keyword: 'hello', limit: 5 },
      ctx
    );
    expect(captured).toEqual([['s', 'hello', 5]]);
    expect(out).toEqual([{ id: 1 }]);
  });

  it('default limit 50', async () => {
    const captured: any[] = [];
    const ctx = mock({
      searchThreadsByTitle: async (...args: any[]) => {
        captured.push(args);
        return [];
      },
    });
    await searchLocalTool.handler({ site_key: 's', keyword: 'x' }, ctx);
    expect(captured[0]).toEqual(['s', 'x', 50]);
  });
});
