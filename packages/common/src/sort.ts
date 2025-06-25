import { z } from 'zod';
import { eventFilterSchema } from './filters';

export const userSortConfigSchema = z
  .object({
    by: eventFilterSchema,
  })
  .optional()
  .catch(undefined);
export type IUserSortConfig = z.infer<typeof userSortConfigSchema>;
