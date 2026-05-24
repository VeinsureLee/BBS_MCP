export class BoardLockManager {
  private inFlight = new Map<number, Promise<unknown>>();

  async runForBoard<T>(board_node_id: number, work: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(board_node_id);
    if (existing) {
      return existing as Promise<T>;
    }
    const p = (async () => {
      try {
        return await work();
      } finally {
        this.inFlight.delete(board_node_id);
      }
    })();
    this.inFlight.set(board_node_id, p);
    return p;
  }
}
