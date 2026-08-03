/**
 * Fail-closed environment variable access.
 *
 * POLICY: Secrets and configuration MUST come from the environment (or the
 * SystemConfig table). Hardcoded fallback values ('|| some-default') are
 * forbidden — if a required variable is missing the operation must fail,
 * never silently run on a known default.
 */

/**
 * Returns the value of a required environment variable.
 * Throws when the variable is missing or empty.
 */
export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

/**
 * Returns the value of an optional environment variable, or undefined.
 * Use for non-critical config only — never for secrets.
 */
export function optionalEnv(name: string): string | undefined {
    const value = process.env[name];
    return value && value.length > 0 ? value : undefined;
}
