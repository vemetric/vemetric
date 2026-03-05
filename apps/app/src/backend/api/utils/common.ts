export function normalizeNullableString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  return value === '' ? null : value;
}

export function normalizeCountryCode(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\0/g, '').trim();
  return normalized === '' ? null : normalized;
}
