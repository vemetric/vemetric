import { hostname } from 'node:os';

export function envPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`Environment variable ${name} must be a positive integer, but got: ${process.env[name]}`);
  }
  return value;
}

// Stored on every processed job (`processedBy`) and in the workers' Redis client names, so jobs and
// connections can be attributed to a replica. Defaults to the hostname, which is the container ID in
// Docker. Redis client names cannot contain spaces.
export const workerName = (process.env.WORKER_NAME || hostname()).replace(/\s+/g, '-');
