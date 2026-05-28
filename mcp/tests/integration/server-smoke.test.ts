import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { registerTools } from '../../src/tools/index';
import { registerResources } from '../../src/resources/index';
import { initLogger } from '../../src/runtime/logger';

vi.mock('bbs-crawler', () => ({
  createCrawler: vi.fn(),
  loadAndResolvePaths: vi.fn(),
}));

function mockCrawler() {
  return {
    service: {} as any,
    readers: {
      listSites: async () => [],
      listSections: async () => [],
      listBoards: async () => [],
    } as any,
    runInitSections: vi.fn(),
    runInitBoards: vi.fn(),
    runInitPinned: vi.fn(),
    runRefreshBoardStats: vi.fn(),
    withLoggedInPage: vi.fn(),
    shutdown: vi.fn(),
  };
}

describe('server smoke', () => {
  let server: McpServer;
  let client: Client;
  beforeAll(async () => {
    initLogger({ level: 'silent' });
    server = new McpServer({ name: 'bbs-mcp', version: '0.0.0' });
    const crawler = mockCrawler() as any;
    registerTools(server, {
      crawler,
      locks: { runForBoard: async (_id: number, fn: () => Promise<unknown>) => fn() } as any,
      graphEnabled: false,
      version: '0.0.0',
      startedAt: Date.now(),
      siteKey: 'school-bbs',
    });
    registerResources(server, { crawler });
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '0.0.0' }, { capabilities: {} });
    await Promise.all([server.connect(a), client.connect(b)]);
  });
  afterAll(async () => {
    try { await client.close(); } catch {}
    try { await server.close(); } catch {}
  });

  it('lists 12 tools', async () => {
    const r = await client.listTools();
    expect(r.tools).toHaveLength(12);
    const names = r.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'forum_board_threads', 'forum_crawl_board', 'forum_crawl_thread', 'forum_get_thread',
      'forum_init', 'forum_list_boards', 'forum_list_sections', 'forum_list_sites',
      'forum_search_local', 'forum_section_detail', 'forum_status', 'ping',
    ]);
  });

  it('lists 1 resource', async () => {
    const r = await client.listResources();
    expect(r.resources).toHaveLength(1);
    expect(r.resources[0]!.uri).toBe('bbs://forum-tree');
  });

  it('ping returns ok', async () => {
    const r = await client.callTool({ name: 'ping', arguments: {} });
    const text = (r.content as Array<{ text: string }>)[0]!.text;
    expect(JSON.parse(text).ok).toBe(true);
  });
});
