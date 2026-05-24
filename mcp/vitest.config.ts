import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  // bbs-crawler points to dist/ which does not exist until built.
  // Tests only use the fake factory; the real bbs-crawler import inside
  // realCrawlerFactory is never executed during unit tests. Mark it external
  // so Vite doesn't try to resolve its package entry at analysis time.
  resolve: {
    conditions: ['node'],
  },
  ssr: {
    external: ['bbs-crawler'],
  },
});
