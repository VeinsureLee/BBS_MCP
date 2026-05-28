import { z } from 'zod';

export interface PingContext { version: string; startedAt: number; }

export const pingTool = {
  name: 'ping',
  description: 'Health probe. Confirms the MCP server process is responsive and reports its version.',
  inputSchema: z.object({}),
  async handler(_input: Record<string, never>, ctx: PingContext) {
    return {
      ok: true,
      version: ctx.version,
      uptime_seconds: Math.floor((Date.now() - ctx.startedAt) / 1000),
    };
  },
};
