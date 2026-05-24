import { z } from 'zod';

export const pingInputSchema = z.object({
  message: z.string().optional(),
});

export const pingTool = {
  name: 'forum_ping',
  description: 'Smoke test tool — echoes a message back with a timestamp.',
  inputSchema: pingInputSchema,
  async handler(input: z.infer<typeof pingInputSchema>, _ctx?: any): Promise<{
    pong: string;
    timestamp: string;
  }> {
    return {
      pong: input.message ?? 'pong',
      timestamp: new Date().toISOString(),
    };
  },
};
