import { z } from 'zod';

export const McpConfigSchema = z.object({
  data_dir: z.string().min(1),

  crawler: z.object({
    site_key: z.string().min(1),
    config_path: z.string().optional(),
  }),

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

export function parseMcpConfig(raw: unknown): McpConfig {
  return McpConfigSchema.parse(raw);
}
