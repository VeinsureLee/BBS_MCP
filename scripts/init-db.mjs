#!/usr/bin/env node
/**
 * Placeholder for the BBS_Database (Neo4j graph layer) initialization.
 *
 * bbs-database's Phase 1 plan (per BBS_Database/docs/design.md §13):
 *   - Start local Neo4j (Community Server or docker compose)
 *   - Run a bootstrap script that mirrors structure.db into Neo4j
 *
 * Until BBS_Database lands its first implementation, this script just
 * prints a friendly note and exits 0 so `npm run init` doesn't fail.
 *
 * When bbs-database ships its bootstrap entry point, replace this file's
 * body with a call to:
 *   npm run -w bbs-database bootstrap
 */

console.log('[init:db] bbs-database not yet implemented (graph layer is M4+).');
console.log('[init:db] this is a placeholder — no work performed.');
console.log('[init:db] see BBS_Database/docs/design.md §13 Phase 1 for the future bootstrap plan.');
process.exit(0);
