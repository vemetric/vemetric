import { z } from 'zod';
import { eventFilterSchema } from './filters';

export const sortDirectionSchema = z.enum(['asc', 'desc']);

export const userSortByFieldSchema = z.enum(['lastSeenAt', 'displayName', 'identifier', 'countryCode']);
export const userSortFieldSchema = z.object({
  type: z.literal('field'),
  fieldName: userSortByFieldSchema,
});

export const userSortConfigSchema = z
  .object({
    by: z.union([eventFilterSchema, userSortFieldSchema]),
    direction: sortDirectionSchema.optional().default('desc'),
  })
  .optional()
  .catch(undefined);
export type IUserSortConfig = z.infer<typeof userSortConfigSchema>;
