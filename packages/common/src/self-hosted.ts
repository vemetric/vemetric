/**
 * Parses an environment variable that is meant to hold a boolean switch.
 *
 * The parser is deliberately strict. A lenient parser treats every unrecognised value as
 * "not true" and therefore silently falls back to the permissive side of a security switch:
 * a typo such as `ALLOW_REGISTRATION=fasle` would leave registration wide open, and
 * `SELF_HOSTED=1` would leave an instance in hosted mode without any signal. Rejecting the
 * value instead turns a misconfiguration into a startup failure that an operator can see.
 *
 * An unset variable, and a variable set to an empty string, both fall back to `defaultValue`.
 * The empty string is treated as unset because container runtimes commonly pass through
 * undefined variables that way.
 * @param name Name of the environment variable to read.
 * @param defaultValue Value used when the variable is unset or empty.
 * @returns The parsed boolean value.
 * @throws Error if the variable holds anything other than `true` or `false`.
 */
export function parseStrictBooleanEnv(name: string, defaultValue: boolean): boolean {
  const rawValue = process.env[name];
  if (rawValue === undefined) {
    return defaultValue;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  if (normalizedValue === '') {
    return defaultValue;
  }
  if (normalizedValue === 'true') {
    return true;
  }
  if (normalizedValue === 'false') {
    return false;
  }

  // The offending value is intentionally not part of the message: environment variables are
  // logged in places where their content should not end up.
  throw new Error(`Invalid value for the environment variable ${name}. Expected either "true" or "false".`);
}

/**
 * Validates boolean environment flags eagerly so a misconfiguration fails the process start
 * instead of surfacing much later, on the first request that happens to read the flag.
 * @param names Names of the environment variables to validate.
 * @throws Error if any of the variables holds a value that is neither `true` nor `false`.
 */
export function assertBooleanEnvFlags(names: ReadonlyArray<string>): void {
  for (const name of names) {
    parseStrictBooleanEnv(name, false);
  }
}

/**
 * Determines whether the backend is running as a self hosted instance.
 *
 * Self hosted instances do not go through Vemetric's billing system: there is no
 * subscription, no plan, and no usage limits. Such an instance always behaves as if
 * it were on the highest available plan, with the full feature set unlocked.
 *
 * Implemented as a function rather than a constant so it always reads the current
 * value of `process.env.SELF_HOSTED`, which matters for tests and for code paths
 * that run before environment variables have finished loading.
 * @returns true if `SELF_HOSTED` is set to `true`, false if it is unset or set to `false`.
 * @throws Error if `SELF_HOSTED` holds an unrecognised value.
 */
export function isSelfHosted(): boolean {
  return parseStrictBooleanEnv('SELF_HOSTED', false);
}
