// A lone UTF-16 surrogate is a valid JS string (e.g. from JSON.parse('"\ud800"')), but JSON.stringify
// writes it as a "\ud800" escape that Redis' cjson and ClickHouse refuse to parse. Same result as
// String.prototype.toWellFormed (ES2024): every lone surrogate becomes U+FFFD.
const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function toWellFormed(value: string) {
  return value.replace(loneSurrogate, '\ufffd');
}

// Applies toWellFormed to every string, including object keys, in plain JSON-like data.
export function toWellFormedDeep<T>(value: T): T {
  if (typeof value === 'string') return toWellFormed(value) as T;
  if (Array.isArray(value)) return value.map((item) => toWellFormedDeep(item)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [toWellFormed(key), toWellFormedDeep(item)]),
    ) as T;
  }
  return value;
}
