import type { Crawler } from 'bbs-crawler';

export const forumTreeUri = 'bbs://forum-tree';

export interface ForumTreeNode {
  kind: 'forum' | 'sub_forum' | 'board';
  node_id: number;
  node_key: string;
  name: string;
  children: ForumTreeNode[];
}
export interface ForumTreeSite { site_key: string; name: string; base_url: string; children: ForumTreeNode[]; }
export interface ForumTree { built_at: string; sites: ForumTreeSite[]; }

/**
 * Build a nested site -> sections -> boards tree from crawler readers.
 * Pure read; safe to call any time after crawler init.
 */
export async function buildForumTree(crawler: Crawler): Promise<ForumTree> {
  const sites = await crawler.readers.listSites();
  const result: ForumTreeSite[] = [];
  for (const s of sites) {
    const sections = await crawler.readers.listSections(s.siteKey);
    const boards = await crawler.readers.listBoards(s.siteKey);
    const nodesById = new Map<number, ForumTreeNode>();
    for (const sec of sections) {
      nodesById.set(sec.id, {
        kind: sec.type,
        node_id: sec.id,
        node_key: sec.sectionKey,
        name: sec.name,
        children: [],
      });
    }
    for (const b of boards) {
      const node: ForumTreeNode = {
        kind: 'board',
        node_id: b.id,
        node_key: b.boardKey,
        name: b.name,
        children: [],
      };
      const parent = b.parentId !== null ? nodesById.get(b.parentId) : undefined;
      if (parent) parent.children.push(node);
    }
    // attach sub_forum into its parent forum
    const topLevel: ForumTreeNode[] = [];
    for (const sec of sections) {
      const node = nodesById.get(sec.id)!;
      if (sec.parentId === null) topLevel.push(node);
      else nodesById.get(sec.parentId)?.children.push(node);
    }
    result.push({
      site_key: s.siteKey,
      name: s.displayName,
      base_url: s.baseUrl,
      children: topLevel,
    });
  }
  return { built_at: new Date().toISOString(), sites: result };
}
