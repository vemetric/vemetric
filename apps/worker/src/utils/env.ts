export function envPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Environment variable ${name} must be a positive integer, but got: ${process.env[name]}`);
  }
  return value;
}
