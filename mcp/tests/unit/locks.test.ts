import { describe, it, expect } from 'vitest';
import { BoardLockManager } from '../../src/runtime/locks.js';

describe('BoardLockManager', () => {
  it('runs second call for same board concurrently by sharing the in-flight promise', async () => {
    const mgr = new BoardLockManager();
    let runs = 0;
    const work = async () => {
      runs++;
      await new Promise((r) => setTimeout(r, 20));
      return runs;
    };
    const [a, b] = await Promise.all([
      mgr.runForBoard(1, work),
      mgr.runForBoard(1, work),
    ]);
    expect(runs).toBe(1); // 第二个调用合并到第一个
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('runs different boards in parallel', async () => {
    const mgr = new BoardLockManager();
    const start = Date.now();
    await Promise.all([
      mgr.runForBoard(1, () => new Promise((r) => setTimeout(r, 50))),
      mgr.runForBoard(2, () => new Promise((r) => setTimeout(r, 50))),
    ]);
    expect(Date.now() - start).toBeLessThan(90); // < 100ms 说明并行
  });

  it('releases lock after work completes', async () => {
    const mgr = new BoardLockManager();
    await mgr.runForBoard(1, async () => 'first');
    let runs = 0;
    const result = await mgr.runForBoard(1, async () => { runs++; return 'second'; });
    expect(runs).toBe(1);
    expect(result).toBe('second');
  });

  it('releases lock after work throws', async () => {
    const mgr = new BoardLockManager();
    await expect(mgr.runForBoard(1, async () => { throw new Error('x'); })).rejects.toThrow();
    const result = await mgr.runForBoard(1, async () => 'ok');
    expect(result).toBe('ok');
  });
});
