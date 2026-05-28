import { describe, it, expect } from 'vitest';
import { boardThreadsTool } from '../../../src/tools/read/board-threads';
import { getThreadTool } from '../../../src/tools/read/get-thread';

describe('boardThreadsTool', () => {
  it('forwards to listThreadsByBoard with all optional fields', async () => {
    const captured: any[] = [];
    const ctx: any = {
      crawler: { readers: { listThreadsByBoard: async (id: number, opts: any) => { captured.push([id, opts]); return []; } } },
    };
    await boardThreadsTool.handler({ board_node_id: 7, kind: 'pinned', limit: 5, offset: 2 }, ctx);
    expect(captured).toEqual([[7, { kind: 'pinned', limit: 5, offset: 2 }]]);
  });

  it('defaults kind=all, limit=50, offset=0', async () => {
    const captured: any[] = [];
    const ctx: any = { crawler: { readers: { listThreadsByBoard: async (id: number, opts: any) => { captured.push(opts); return []; } } } };
    await boardThreadsTool.handler({ board_node_id: 1 }, ctx);
    expect(captured[0]).toEqual({ kind: 'all', limit: 50, offset: 0 });
  });
});

describe('getThreadTool', () => {
  it('returns thread+posts or null', async () => {
    const ctx: any = {
      crawler: { readers: { getThreadByUrl: async (s: string, u: string) => (u === 'https://x/known' ? { thread: { id: 1 }, posts: [] } : null) } },
    };
    expect(await getThreadTool.handler({ site_key: 's', url: 'https://x/known' }, ctx)).toEqual({ thread: { id: 1 }, posts: [] });
    expect(await getThreadTool.handler({ site_key: 's', url: 'https://x/nope' }, ctx)).toBeNull();
  });
});
