import Database from 'better-sqlite3';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Build a minimal SQLite fixture mimicking crawler output:
 *   <root>/structure.db  — site + 2 boards
 *   <root>/forums/forum-life/guanshui.db  — 1 pinned thread + 2 plain threads + 2 posts
 *   <root>/forums/forum-life/jishu.db     — 1 plain thread
 *
 * Schema must match BBS_Crawler/src/repository/db.ts STRUCTURE_SCHEMA / BOARD_SCHEMA.
 */
export function buildFixture(root: string): void {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(root, 'forums'), { recursive: true });

  // structure.db
  const sdb = new Database(join(root, 'structure.db'));
  sdb.exec(`
    CREATE TABLE sites (
      site_key TEXT PRIMARY KEY, name TEXT, base_url TEXT
    );
    CREATE TABLE nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_key TEXT NOT NULL,
      node_key TEXT NOT NULL,
      name TEXT NOT NULL,
      parent_id INTEGER,
      type TEXT NOT NULL,
      level INTEGER NOT NULL,
      full_path TEXT,
      db_path TEXT,
      moderators TEXT,
      last_crawled_at TEXT
    );
  `);
  sdb.prepare(`INSERT INTO sites (site_key, name, base_url) VALUES (?, ?, ?)`)
    .run('school-bbs', 'Test School BBS', 'https://example.edu/bbs');
  sdb.prepare(`INSERT INTO nodes (site_key, node_key, name, parent_id, type, level, full_path, db_path, last_crawled_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('school-bbs', 'forum-life', '生活', null, 'forum', 1, 'forum-life', null, null);
  sdb.prepare(`INSERT INTO nodes (site_key, node_key, name, parent_id, type, level, full_path, db_path, last_crawled_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('school-bbs', 'guanshui', '灌水', 1, 'board', 2, 'forum-life/guanshui', 'forums/forum-life/guanshui.db', '2026-05-24T10:00:00Z');
  sdb.prepare(`INSERT INTO nodes (site_key, node_key, name, parent_id, type, level, full_path, db_path, last_crawled_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run('school-bbs', 'jishu', '技术', 1, 'board', 2, 'forum-life/jishu', 'forums/forum-life/jishu.db', '2026-05-23T08:00:00Z');
  sdb.close();

  // forum dbs (create empty tables for both)
  for (const path of ['forums/forum-life/guanshui.db', 'forums/forum-life/jishu.db']) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    const bdb = new Database(join(root, path));
    bdb.exec(`
      CREATE TABLE threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_node_id INTEGER NOT NULL,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        author TEXT,
        posted_at TEXT,
        last_reply_at TEXT,
        reply_count INTEGER,
        view_count INTEGER,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        raw TEXT,
        first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER NOT NULL,
        floor INTEGER NOT NULL,
        author TEXT NOT NULL,
        posted_at TEXT,
        content_html TEXT NOT NULL,
        content_text TEXT NOT NULL,
        attachments TEXT,
        raw TEXT,
        UNIQUE (thread_id, floor)
      );
    `);
    bdb.close();
  }

  // populate guanshui (board_node_id=2)
  const gdb = new Database(join(root, 'forums/forum-life/guanshui.db'));
  gdb.prepare(`INSERT INTO threads (board_node_id, url, title, author, posted_at, reply_count, is_pinned, first_seen_at, last_fetched_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(2, 'https://example.edu/t/1', '版规公告', 'admin', '2026-05-01T00:00:00Z', 3, 1, '2026-05-01T00:00:00Z', '2026-05-24T00:00:00Z');
  gdb.prepare(`INSERT INTO threads (board_node_id, url, title, author, posted_at, reply_count, is_pinned, first_seen_at, last_fetched_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(2, 'https://example.edu/t/2', '食堂第三餐厅怎么样', 'alice', '2026-05-20T10:00:00Z', 5, 0, '2026-05-20T10:00:00Z', '2026-05-24T00:00:00Z');
  gdb.prepare(`INSERT INTO threads (board_node_id, url, title, author, posted_at, reply_count, is_pinned, first_seen_at, last_fetched_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(2, 'https://example.edu/t/3', '张三老师课怎么样', 'bob', '2026-05-22T14:30:00Z', 2, 0, '2026-05-22T14:30:00Z', '2026-05-24T00:00:00Z');
  gdb.prepare(`INSERT INTO posts (thread_id, floor, author, posted_at, content_html, content_text) VALUES (?,?,?,?,?,?)`)
    .run(2, 1, 'alice', '2026-05-20T10:00:00Z', '<p>问题</p>', '问题');
  gdb.prepare(`INSERT INTO posts (thread_id, floor, author, posted_at, content_html, content_text) VALUES (?,?,?,?,?,?)`)
    .run(2, 2, 'carol', '2026-05-20T11:00:00Z', '<p>还行</p>', '还行');
  gdb.close();

  // populate jishu (board_node_id=3)
  const jdb = new Database(join(root, 'forums/forum-life/jishu.db'));
  jdb.prepare(`INSERT INTO threads (board_node_id, url, title, author, posted_at, reply_count, is_pinned, first_seen_at, last_fetched_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(3, 'https://example.edu/t/4', '推荐一个 Rust 教程', 'dave', '2026-05-23T08:00:00Z', 1, 0, '2026-05-23T08:00:00Z', '2026-05-24T00:00:00Z');
  jdb.close();
}
