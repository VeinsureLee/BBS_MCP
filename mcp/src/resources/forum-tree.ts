import type { Readers } from '../runtime/sqlite-readers.js';

export const forumTreeUri = 'bbs://forum-tree';

export interface ForumTreeNode {
  kind: 'forum' | 'sub_forum' | 'board';
  node_id: number;
  node_key: string;
  name: string;
  pinned_count?: number;
  plain_count?: number;
  last_crawled_at?: string | null;
  children: ForumTreeNode[];
}

export interface ForumTreeSite {
  site_key: string;
  name: string;
  base_url: string;
  children: ForumTreeNode[];
}

export interface ForumTree {
  built_at: string;
  sites: ForumTreeSite[];
}

/**
 * Build a nested tree from the structure.db + per-board counts.
 * Cheap: open each board db once via Readers' lazy cache.
 */
export function buildForumTree(readers: Readers): ForumTree {
  return readers.buildForumTree();
}
