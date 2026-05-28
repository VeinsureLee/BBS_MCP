import { z } from 'zod';

export const McpConfigSchema = z.object({
  logDir: z.string().default('.logs/mcp'),
  graphEnabled: z.boolean().default(false),
});

export type McpConfig = z.infer<typeof McpConfigSchema>;
export function parseMcpConfig(raw: unknown): McpConfig { return McpConfigSchema.parse(raw); }
