import { z } from 'zod';

const anyOperator = z.literal('any');
const andOperator = z.literal('and');
const orOperator = z.literal('or');
const isOperator = z.literal('is');
const isNotOperator = z.literal('isNot');
const containsOperator = z.literal('contains');
const notContainsOperator = z.literal('notContains');
const startsWithOperator = z.literal('startsWith');
const endsWithOperator = z.literal('endsWith');
const greaterThanOperator = z.literal('gt');
const greaterThanOrEqualOperator = z.literal('gte');
const lessThanOperator = z.literal('lt');
const lessThanOrEqualOperator = z.literal('lte');
const oneOfOperator = z.literal('oneOf');
const noneOfOperator = z.literal('noneOf');

const stringOperators = [
  anyOperator,
  isOperator,
  isNotOperator,
  containsOperator,
  notContainsOperator,
  startsWithOperator,
  endsWithOperator,
] as const;
export const stringOperatorsSchema = z.union(stringOperators);
export const stringOperatorValues = stringOperators.map((operator) => operator.value);
const stringFilterSchema = z.object({
  value: z.string(),
  operator: stringOperatorsSchema,
});
export type IStringFilterOperator = z.infer<typeof stringOperatorsSchema>;
export type IStringFilter = z.infer<typeof stringFilterSchema>;

const numberOperators = [
  anyOperator,
  isOperator,
  isNotOperator,
  greaterThanOperator,
  greaterThanOrEqualOperator,
  lessThanOperator,
  lessThanOrEqualOperator,
] as const;
export const numberOperatorValues = numberOperators.map((operator) => operator.value);
// eslint-disable-next-line unused-imports/no-unused-vars
const numberFilterSchema = z.object({
  value: z.number(),
  operator: z.union(numberOperators),
});
export type INumberFilter = z.infer<typeof numberFilterSchema>;

const listOperators = [anyOperator, oneOfOperator, noneOfOperator] as const;
export const listOperatorValues = listOperators.map((operator) => operator.value);
const listFilterSchema = z.object({
  value: z.array(z.string()),
  operator: z.union(listOperators),
});
export type IListFilter = z.infer<typeof listFilterSchema>;

export const pageFilterSchema = z.object({
  type: z.literal('page'),
  originFilter: stringFilterSchema.optional(),
  pathFilter: stringFilterSchema.optional(),
  hashFilter: stringFilterSchema.optional(),
});
export type IPageFilter = z.infer<typeof pageFilterSchema>;

export const eventFilterSchema = z.object({
  type: z.literal('event'),
  nameFilter: stringFilterSchema.optional(),
  propertiesFilter: z
    .array(
      z.object({
        property: z.string(),
        valueFilter: stringFilterSchema,
      }),
    )
    .optional(),
});
export type IEventFilter = z.infer<typeof eventFilterSchema>;

const userFilterSchema = z.object({
  type: z.literal('user'),
  anonymous: z.boolean(),
});
export type IUserFilter = z.infer<typeof userFilterSchema>;

const locationFilterSchema = z.object({
  type: z.literal('location'),
  countryFilter: listFilterSchema.optional(),
});
export type ILocationFilter = z.infer<typeof locationFilterSchema>;

const referrerFilterSchema = z.object({
  type: z.literal('referrer'),
  referrerFilter: stringFilterSchema.optional(),
});
export type IReferrerFilter = z.infer<typeof referrerFilterSchema>;

const referrerUrlFilterSchema = z.object({
  type: z.literal('referrerUrl'),
  referrerUrlFilter: stringFilterSchema.optional(),
});
export type IReferrerUrlFilter = z.infer<typeof referrerUrlFilterSchema>;

const referrerTypeFilterSchema = z.object({
  type: z.literal('referrerType'),
  referrerTypeFilter: listFilterSchema.optional(),
});
export type IReferrerTypeFilter = z.infer<typeof referrerTypeFilterSchema>;

const utmTagsFilterSchema = z.object({
  type: z.literal('utmTags'),
  utmCampaignFilter: stringFilterSchema.optional(),
  utmContentFilter: stringFilterSchema.optional(),
  utmMediumFilter: stringFilterSchema.optional(),
  utmSourceFilter: stringFilterSchema.optional(),
  utmTermFilter: stringFilterSchema.optional(),
});
export type IUtmTagsFilter = z.infer<typeof utmTagsFilterSchema>;

const browserFilterSchema = z.object({
  type: z.literal('browser'),
  browserFilter: listFilterSchema.optional(),
});
export type IBrowserFilter = z.infer<typeof browserFilterSchema>;

const deviceFilterSchema = z.object({
  type: z.literal('device'),
  deviceFilter: listFilterSchema.optional(),
});
export type IDeviceFilter = z.infer<typeof deviceFilterSchema>;

const osFilterSchema = z.object({
  type: z.literal('os'),
  osFilter: listFilterSchema.optional(),
});
export type IOsFilter = z.infer<typeof osFilterSchema>;

const filterSchema = z.union([
  pageFilterSchema,
  eventFilterSchema,
  userFilterSchema,
  locationFilterSchema,
  referrerFilterSchema,
  referrerUrlFilterSchema,
  referrerTypeFilterSchema,
  utmTagsFilterSchema,
  browserFilterSchema,
  deviceFilterSchema,
  osFilterSchema,
]);
export type IFilter = z.infer<typeof filterSchema>;

const filterGroupOperators = [andOperator, orOperator] as const;
export const filterGroupOperatorValues = filterGroupOperators.map((operator) => operator.value);
export type IFilterGroup = {
  type: 'group';
  filters: Array<IFilter | IFilterGroup>;
  operator: 'and' | 'or';
};

const filterGroupSchema: z.ZodType<IFilterGroup> = z.object({
  type: z.literal('group'),
  filters: z.array(z.union([filterSchema, z.lazy(() => filterGroupSchema)])),
  operator: z.union(filterGroupOperators),
});

export const filterConfigSchema = z
  .object({
    filters: z.array(z.union([filterSchema, z.lazy(() => filterGroupSchema)])),
    operator: z.union(filterGroupOperators),
  })
  .optional()
  .catch(undefined);
export type IFilterConfig = z.infer<typeof filterConfigSchema>;

export type IOperator =
  | z.infer<typeof stringFilterSchema.shape.operator>
  | z.infer<typeof numberFilterSchema.shape.operator>
  | z.infer<typeof listFilterSchema.shape.operator>
  | IFilterGroup['operator'];

export const hasMultipleSubfiltersActive = (filter: IFilter) => {
  let hasSubfilters = false;

  for (const value of Object.values(filter)) {
    if (typeof value === 'object' && 'operator' in value) {
      if (value.operator !== 'any') {
        if (!hasSubfilters) {
          hasSubfilters = true;
        } else {
          return true;
        }
      }
    }
  }
  return false;
};
