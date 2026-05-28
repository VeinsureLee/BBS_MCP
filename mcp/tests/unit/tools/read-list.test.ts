import { describe, it, expect } from 'vitest';
import { listSitesTool } from '../../../src/tools/read/list-sites';
import { listSectionsTool } from '../../../src/tools/read/list-sections';
import { listBoardsTool } from '../../../src/tools/read/list-boards';

function mock(readers: Partial<any>) {
  return { crawler: { readers } } as any;
}

describe('listSitesTool', () => {
  it('passes through crawler.readers.listSites()', async () => {
    const expected = [{ siteKey: 'school-bbs', displayName: 'X', baseUrl: 'http://x' }];
    const out = await listSitesTool.handler({}, mock({ listSites: async () => expected }));
    expect(out).toEqual(expected);
  });
});

describe('listSectionsTool', () => {
  it('passes site_key through', async () => {
    const captured: string[] = [];
    const expected = [{ id: 1, sectionKey: 'F' }];
    const ctx = mock({ listSections: async (s: string) => { captured.push(s); return expected as any; } });
    const out = await listSectionsTool.handler({ site_key: 'school-bbs' }, ctx);
    expect(captured).toEqual(['school-bbs']);
    expect(out).toEqual(expected);
  });
});

describe('listBoardsTool', () => {
  it('passes site_key and optional parent_section_id', async () => {
    const captured: any[] = [];
    const expected = [{ id: 9, boardKey: 'B' }];
    const ctx = mock({ listBoards: async (s: string, p?: number) => { captured.push([s, p]); return expected as any; } });
    const out = await listBoardsTool.handler({ site_key: 's', parent_section_id: 3 }, ctx);
    expect(captured).toEqual([['s', 3]]);
    expect(out).toEqual(expected);

    captured.length = 0;
    await listBoardsTool.handler({ site_key: 's' }, ctx);
    expect(captured).toEqual([['s', undefined]]);
  });
});
