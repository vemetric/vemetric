export const isEntityUnknown = (value?: string) => {
  return !value || value.toLowerCase() === 'unknown';
};
