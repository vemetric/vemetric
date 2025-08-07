import { z } from 'zod';
import { eventFilterSchema, pageFilterSchema } from './filters';

export const funnelStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  filter: z.union([pageFilterSchema, eventFilterSchema]),
});

export type FunnelStep = z.infer<typeof funnelStepSchema>;
