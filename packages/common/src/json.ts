export function jsonStringify(value: any) {
  return JSON.stringify(value, (_key, value) => {
    if (typeof value === 'bigint') {
      return String(value);
    }

    return value;
  });
}
