export interface Freshness {
  as_of: string;
  board_last_crawled_at?: string;
  threads_in_result_newest?: string;
  graph_last_synced_at?: string;
}

export interface FreshnessInput {
  board_last_crawled_at?: string | null;
  threads?: { posted_at?: string | null }[];
  graphEnabled?: boolean;
  graphLastSyncedAt?: string;
}

export function buildFreshness(input: FreshnessInput): Freshness {
  const out: Freshness = { as_of: new Date().toISOString() };
  if (input.board_last_crawled_at) out.board_last_crawled_at = input.board_last_crawled_at;
  if (input.threads && input.threads.length > 0) {
    let newest: string | undefined;
    for (const t of input.threads) {
      const p = t.posted_at ?? undefined;
      if (p && (!newest || p > newest)) newest = p;
    }
    if (newest) out.threads_in_result_newest = newest;
  }
  if (input.graphEnabled && input.graphLastSyncedAt) {
    out.graph_last_synced_at = input.graphLastSyncedAt;
  }
  return out;
}
