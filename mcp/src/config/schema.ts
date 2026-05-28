import { z } from 'zod';

// New, minimal env-driven config (post-refactor target shape).
export const McpConfigSchema = z.object({
  // === NEW (post-refactor) ===
  logDir: z.string().default('.logs/mcp'),
  graphEnabled: z.boolean().default(false),

  // === LEGACY (kept compiling until server.ts is rewritten in Task 15) ===
  data_dir: z.string().min(1).optional(),
  crawler: z.object({
    site_key: z.string().min(1),
    config_path: z.string().optional(),
  }).optional(),
  graph: z.object({
    enabled: z.union([z.literal('auto'), z.boolean()]).default('auto'),
    database_config_path: z.string().optional(),
    neo4j: z.object({
      uri: z.string().default('bolt://localhost:7687'),
      user: z.string().default('neo4j'),
      password_env: z.string().default('NEO4J_PASSWORD'),
    }).default({}),
  }).default({}),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: z.string().optional(),
  }).default({}),
});

export type McpConfig = z.infer<typeof McpConfigSchema>;
export function parseMcpConfig(raw: unknown): McpConfig { return McpConfigSchema.parse(raw); }

/**
 * Legacy schema used by loadMcpConfig / loadFromEnv (file-based path).
 * Keeps data_dir and crawler required so server.ts (pre-Task-15) compiles.
 * Removed in Task 16 when server.ts is rewritten.
 */
export const LegacyMcpConfigSchema = McpConfigSchema.extend({
  data_dir: z.string().min(1),
  crawler: z.object({
    site_key: z.string().min(1),
    config_path: z.string().optional(),
  }),
});

export type LegacyMcpConfig = z.infer<typeof LegacyMcpConfigSchema>;
export function parseLegacyMcpConfig(raw: unknown): LegacyMcpConfig { return LegacyMcpConfigSchema.parse(raw); }
