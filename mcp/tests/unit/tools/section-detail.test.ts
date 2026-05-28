import { describe, it, expect } from 'vitest';
import { sectionDetailTool } from '../../../src/tools/read/section-detail';

describe('sectionDetailTool', () => {
  it('passes args to readers.getSectionDetail and returns its result', async () => {
    const captured: any[] = [];
    const expected = { section: { id: 1 }, sub_sections: [], boards: [] };
    const ctx: any = {
      crawler: {
        readers: {
          getSectionDetail: async (s: string, k: string, o?: any) => {
            captured.push([s, k, o]);
            return expected;
          },
        },
      },
    };
    const out = await sectionDetailTool.handler(
      { site_key: 's', section_key: 'F', recent_limit: 5 },
      ctx,
    );
    expect(captured).toEqual([['s', 'F', { recentLimit: 5 }]]);
    expect(out).toEqual(expected);
  });

  it('defaults recent_limit to 10', async () => {
    const captured: any[] = [];
    const ctx: any = {
      crawler: { readers: { getSectionDetail: async (s: string, k: string, o?: any) => { captured.push(o); return {} as any; } } },
    };
    await sectionDetailTool.handler({ site_key: 's', section_key: 'F' }, ctx);
    expect(captured[0]).toEqual({ recentLimit: 10 });
  });
});
