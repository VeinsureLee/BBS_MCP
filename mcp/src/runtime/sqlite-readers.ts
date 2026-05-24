import Database from 'better-sqlite3';
import { join, isAbsolute } from 'node:path';

export interface SiteRow {
  site_key: string;
  name: string;
  base_url: string;
}

export interface BoardRow {
  node_id: number;
  site_key: string;
  node_key: string;
  name: string;
  path: string[];
  db_path: string;
  last_crawled_at: string | null;
  pinned_count: number;
  plain_count: number;
}

export interface ThreadRow {
  thread_id: number;
  board_node_id: number;
  url: string;
  title: string;
  author: string | null;
  posted_at: string | null;
  last_reply_at: string | null;
  reply_count: number | null;
  view_count: number | null;
  is_pinned: boolean;
}

export interface PostRow {
  floor: number;
  author: string;
  posted_at: string | null;
  content_html: string;
  content_text: string;
  attachments: unknown;
}

export interface ThreadsByBoardOptions {
  kind: 'pinned' | 'plain' | 'all';
  since?: string;
  limit: number;
  offset?: number;
}

export interface Readers {
  listSites(): SiteRow[];
  listBoards(site_key?: string): BoardRow[];
  getBoardById(node_id: number): BoardRow | null;
  threadsByBoard(node_id: number, opts: ThreadsByBoardOptions): { threads: ThreadRow[] };
  getThreadByUrl(url: string): { thread: ThreadRow; posts: PostRow[] } | null;
  getThreadById(forum_db: string, thread_id: number): { thread: ThreadRow; posts: PostRow[] } | null;
  searchTitles(query: string, opts: { board_node_id?: number; limit: number }): { threads: ThreadRow[] };
  resolveDbPath(relative_or_abs: string): string;
  close(): void;
}

export function openReaders(data_dir: string): Readers {
  const structurePath = join(data_dir, 'structure.db');
  const sdb = new Database(structurePath, { readonly: true, fileMustExist: true });

  const boardDbs = new Map<string, Database.Database>();
  function openBoardDb(rel: string): Database.Database {
    const abs = isAbsolute(rel) ? rel : join(data_dir, rel);
    let db = boardDbs.get(abs);
    if (!db) {
      db = new Database(abs, { readonly: true, fileMustExist: true });
      boardDbs.set(abs, db);
    }
    return db;
  }

  function buildPath(node_id: number): string[] {
    const parts: string[] = [];
    let cur: { name: string; parent_id: number | null } | undefined = sdb
      .prepare<[number], { name: string; parent_id: number | null }>(
        `SELECT name, parent_id FROM nodes WHERE id = ?`,
      )
      .get(node_id);
    while (cur) {
      parts.unshift(cur.name);
      if (cur.parent_id == null) break;
      cur = sdb
        .prepare<[number], { name: string; parent_id: number | null }>(
          `SELECT name, parent_id FROM nodes WHERE id = ?`,
        )
        .get(cur.parent_id);
    }
    return parts;
  }

  function nodeIdToBoardRow(node: {
    id: number;
    site_key: string;
    node_key: string;
    name: string;
    full_path: string | null;
    db_path: string | null;
    last_crawled_at: string | null;
    parent_id: number | null;
  }): BoardRow {
    if (!node.db_path) {
      throw new Error(`board node ${node.id} has no db_path`);
    }
    const path = buildPath(node.id);
    const bdb = openBoardDb(node.db_path);
    const counts = bdb
      .prepare<unknown[], { is_pinned: number; cnt: number }>(
        `SELECT is_pinned, COUNT(*) AS cnt FROM threads GROUP BY is_pinned`,
      )
      .all() as { is_pinned: number; cnt: number }[];
    let pinned = 0,
      plain = 0;
    for (const row of counts) {
      if (row.is_pinned === 1) pinned = row.cnt;
      else plain = row.cnt;
    }
    return {
      node_id: node.id,
      site_key: node.site_key,
      node_key: node.node_key,
      name: node.name,
      path,
      db_path: node.db_path,
      last_crawled_at: node.last_crawled_at,
      pinned_count: pinned,
      plain_count: plain,
    };
  }

  return {
    listSites() {
      return sdb
        .prepare<unknown[], SiteRow>(`SELECT site_key, name, base_url FROM sites`)
        .all() as SiteRow[];
    },

    listBoards(site_key) {
      const rows = site_key
        ? sdb
            .prepare<[string], any>(
              `SELECT id, site_key, node_key, name, full_path, db_path, last_crawled_at, parent_id FROM nodes WHERE type='board' AND site_key = ? ORDER BY id`,
            )
            .all(site_key)
        : sdb
            .prepare<unknown[], any>(
              `SELECT id, site_key, node_key, name, full_path, db_path, last_crawled_at, parent_id FROM nodes WHERE type='board' ORDER BY id`,
            )
            .all();
      return (rows as any[]).map(nodeIdToBoardRow);
    },

    getBoardById(node_id) {
      const row = sdb
        .prepare<[number], any>(
          `SELECT id, site_key, node_key, name, full_path, db_path, last_crawled_at, parent_id FROM nodes WHERE id = ? AND type='board'`,
        )
        .get(node_id);
      return row ? nodeIdToBoardRow(row as any) : null;
    },

    threadsByBoard(node_id, opts) {
      const board = this.getBoardById(node_id);
      if (!board) return { threads: [] };
      const bdb = openBoardDb(board.db_path);
      const whereParts: string[] = ['board_node_id = ?'];
      const params: unknown[] = [node_id];
      if (opts.kind === 'pinned') whereParts.push('is_pinned = 1');
      else if (opts.kind === 'plain') whereParts.push('is_pinned = 0');
      if (opts.since) {
        whereParts.push('posted_at >= ?');
        params.push(opts.since);
      }
      params.push(opts.limit);
      params.push(opts.offset ?? 0);
      const sql = `SELECT id, board_node_id, url, title, author, posted_at, last_reply_at, reply_count, view_count, is_pinned
                   FROM threads
                   WHERE ${whereParts.join(' AND ')}
                   ORDER BY is_pinned DESC, posted_at DESC
                   LIMIT ? OFFSET ?`;
      const rows = bdb.prepare<unknown[], any>(sql).all(...params) as any[];
      return {
        threads: rows.map((r) => ({
          thread_id: r.id,
          board_node_id: r.board_node_id,
          url: r.url,
          title: r.title,
          author: r.author,
          posted_at: r.posted_at,
          last_reply_at: r.last_reply_at,
          reply_count: r.reply_count,
          view_count: r.view_count,
          is_pinned: r.is_pinned === 1,
        })),
      };
    },

    getThreadByUrl(url) {
      // First scan already-opened board dbs; if not found, open all boards and retry.
      let lookup = scanCachedFor(boardDbs, url);
      if (!lookup) {
        for (const board of this.listBoards()) {
          openBoardDb(board.db_path);
        }
        lookup = scanCachedFor(boardDbs, url);
      }
      if (!lookup) return null;
      const t = lookup.thread;
      const posts = lookup.db
        .prepare<[number], any>(
          `SELECT floor, author, posted_at, content_html, content_text, attachments FROM posts WHERE thread_id = ? ORDER BY floor ASC`,
        )
        .all(t.id) as any[];
      return {
        thread: {
          thread_id: t.id,
          board_node_id: t.board_node_id,
          url: t.url,
          title: t.title,
          author: t.author,
          posted_at: t.posted_at,
          last_reply_at: t.last_reply_at,
          reply_count: t.reply_count,
          view_count: t.view_count,
          is_pinned: t.is_pinned === 1,
        },
        posts: posts.map((p) => ({
          floor: p.floor,
          author: p.author,
          posted_at: p.posted_at,
          content_html: p.content_html,
          content_text: p.content_text,
          attachments: p.attachments ? (JSON.parse(p.attachments) as unknown) : null,
        })),
      };
    },

    getThreadById(forum_db, thread_id) {
      const bdb = openBoardDb(forum_db);
      const t = bdb
        .prepare<[number], any>(
          `SELECT id, board_node_id, url, title, author, posted_at, last_reply_at, reply_count, view_count, is_pinned FROM threads WHERE id = ?`,
        )
        .get(thread_id) as any;
      if (!t) return null;
      const posts = bdb
        .prepare<[number], any>(
          `SELECT floor, author, posted_at, content_html, content_text, attachments FROM posts WHERE thread_id = ? ORDER BY floor ASC`,
        )
        .all(thread_id) as any[];
      return {
        thread: {
          thread_id: t.id,
          board_node_id: t.board_node_id,
          url: t.url,
          title: t.title,
          author: t.author,
          posted_at: t.posted_at,
          last_reply_at: t.last_reply_at,
          reply_count: t.reply_count,
          view_count: t.view_count,
          is_pinned: t.is_pinned === 1,
        },
        posts: posts.map((p) => ({
          floor: p.floor,
          author: p.author,
          posted_at: p.posted_at,
          content_html: p.content_html,
          content_text: p.content_text,
          attachments: p.attachments ? (JSON.parse(p.attachments) as unknown) : null,
        })),
      };
    },

    searchTitles(query, opts) {
      const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
      if (opts.board_node_id !== undefined) {
        const board = this.getBoardById(opts.board_node_id);
        if (!board) return { threads: [] };
        const bdb = openBoardDb(board.db_path);
        const rows = bdb
          .prepare<unknown[], any>(
            `SELECT id, board_node_id, url, title, author, posted_at, last_reply_at, reply_count, view_count, is_pinned
             FROM threads
             WHERE title LIKE ? ESCAPE '\\'
             ORDER BY posted_at DESC LIMIT ?`,
          )
          .all(pattern, opts.limit) as any[];
        return { threads: rows.map(mapThreadRow) };
      } else {
        // Cross-board global search: query each db and merge.
        const out: ThreadRow[] = [];
        for (const board of this.listBoards()) {
          const bdb = openBoardDb(board.db_path);
          const rows = bdb
            .prepare<unknown[], any>(
              `SELECT id, board_node_id, url, title, author, posted_at, last_reply_at, reply_count, view_count, is_pinned
               FROM threads
               WHERE title LIKE ? ESCAPE '\\'
               ORDER BY posted_at DESC LIMIT ?`,
            )
            .all(pattern, opts.limit) as any[];
          for (const r of rows) out.push(mapThreadRow(r));
          if (out.length >= opts.limit * 4) break; // soft cap
        }
        out.sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? ''));
        return { threads: out.slice(0, opts.limit) };
      }
    },

    resolveDbPath(p) {
      return isAbsolute(p) ? p : join(data_dir, p);
    },

    close() {
      sdb.close();
      for (const db of boardDbs.values()) db.close();
      boardDbs.clear();
    },
  };
}

function scanCachedFor(
  cache: Map<string, Database.Database>,
  url: string,
): { db: Database.Database; thread: any } | null {
  for (const db of cache.values()) {
    const row = db
      .prepare<[string], any>(
        `SELECT id, board_node_id, url, title, author, posted_at, last_reply_at, reply_count, view_count, is_pinned FROM threads WHERE url = ?`,
      )
      .get(url);
    if (row) return { db, thread: row };
  }
  return null;
}

function mapThreadRow(r: any): ThreadRow {
  return {
    thread_id: r.id,
    board_node_id: r.board_node_id,
    url: r.url,
    title: r.title,
    author: r.author,
    posted_at: r.posted_at,
    last_reply_at: r.last_reply_at,
    reply_count: r.reply_count,
    view_count: r.view_count,
    is_pinned: r.is_pinned === 1,
  };
}
