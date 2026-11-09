/**
 * Startup environment validation (fail fast).
 *
 * A container whose configuration is wrong still answers /api/health/live, so Coolify would roll traffic onto it and the
 * mistake would only surface when a user hits the broken feature. Validating at boot makes the process exit instead, the
 * rollout stops and the previous container keeps serving.
 *
 * Rules:
 *  - Messages name the variable and the problem, never the value.
 *  - Errors stop the process in production; elsewhere everything is reported as a warning.
 *  - SKIP_ENV_VALIDATION=true is an emergency escape hatch (logged loudly).
 */

export type EnvSeverity = 'error' | 'warn';

export interface EnvIssue {
    name: string;
    severity: EnvSeverity;
    message: string;
}

export interface EnvValidationResult {
    ok: boolean;
    issues: EnvIssue[];
}

type Env = Record<string, string | undefined>;

const POSTGRES_URL = /^postgres(ql)?:\/\/[^\s]+$/i;
const REDIS_URL = /^rediss?:\/\/[^\s]+$/i;
const HTTP_URL = /^https?:\/\/[^\s]+$/i;
/** Placeholder secrets that must never reach production */
const WEAK_SECRETS = new Set(['secret', 'changeme', 'change-me', 'your-secret-key', 'jwt_secret', 'password', 'default', 'test', 'development']);

const has = (v: string | undefined): v is string => typeof v === 'string' && v.trim().length > 0;

export function validateEnvironment(env: Env = process.env): EnvValidationResult {
    const production = env.NODE_ENV === 'production';
    const issues: EnvIssue[] = [];
    const add = (name: string, severity: EnvSeverity, message: string) => issues.push({ name, severity, message });
    // outside production a missing variable is only a warning
    const hard: EnvSeverity = production ? 'error' : 'warn';

    // --- Database
    if (!has(env.DATABASE_URL)) add('DATABASE_URL', hard, 'is not set');
    else if (!POSTGRES_URL.test(env.DATABASE_URL)) add('DATABASE_URL', hard, 'must be a postgres:// or postgresql:// URL');

    if (has(env.DIRECT_URL) && !POSTGRES_URL.test(env.DIRECT_URL)) add('DIRECT_URL', 'warn', 'is set but is not a postgres:// URL (migrations use it)');
    else if (production && !has(env.DIRECT_URL)) add('DIRECT_URL', 'warn', 'is not set (only the release job needs it, the web process does not)');

    if (has(env.READ_REPLICA_URL) && !POSTGRES_URL.test(env.READ_REPLICA_URL)) {
        add('READ_REPLICA_URL', hard, 'is set but is not a postgres:// URL; unset it to use the primary for reads');
    }

    // --- Queue / cache
    if (!has(env.REDIS_URL)) add('REDIS_URL', hard, 'is not set (queues, events and cache need it)');
    else if (!REDIS_URL.test(env.REDIS_URL)) add('REDIS_URL', hard, 'must be a redis:// or rediss:// URL');

    // --- Authentication
    const jwt = env.JWT_SECRET;
    if (!has(jwt)) add('JWT_SECRET', hard, 'is not set');
    else {
        if (production && WEAK_SECRETS.has(jwt.trim().toLowerCase())) add('JWT_SECRET', 'error', 'is a well-known placeholder value');
        else if (jwt.length < 16) add('JWT_SECRET', hard, `is too short (${jwt.length} characters, minimum 16)`);
        else if (jwt.length < 32) add('JWT_SECRET', 'warn', `is shorter than the recommended 32 characters (${jwt.length}); rotate it when sessions can be reset`);
    }

    // --- Cron endpoints are protected by this secret
    if (production && !has(env.CRON_SECRET)) add('CRON_SECRET', 'warn', 'is not set, scheduled /api/cron calls will be rejected');

    // --- Links in emails and notifications
    const appUrl = env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL;
    if (production && !(has(appUrl) && HTTP_URL.test(appUrl))) {
        add('APP_BASE_URL', 'warn', 'neither APP_BASE_URL nor NEXT_PUBLIC_APP_URL is an absolute http(s) URL; links in emails may be wrong');
    }

    // --- Object storage: file uploads fail without it, but the rest of the app works, so this never blocks startup
    if (env.STORAGE_REQUIRE_S3 === 'true' || production) {
        const localOk = env.STORAGE_ALLOW_LOCAL_FALLBACK === 'true';
        for (const name of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']) {
            if (!has(env[name]) && !localOk) add(name, 'warn', 'is not set: S3 storage is required here, so file uploads will fail until it is configured');
        }
    }

    return { ok: !issues.some((i) => i.severity === 'error'), issues };
}

export class EnvValidationError extends Error {
    constructor(public readonly issues: EnvIssue[]) {
        super(`Invalid environment configuration: ${issues.filter((i) => i.severity === 'error').map((i) => `${i.name} ${i.message}`).join('; ')}`);
        this.name = 'EnvValidationError';
    }
}

/**
 * Validates the environment, logs every finding and throws EnvValidationError when a blocking problem exists.
 * Returns the result when startup may continue.
 */
export function assertEnvironment(env: Env = process.env, log: Pick<Console, 'warn' | 'error' | 'log'> = console): EnvValidationResult {
    const result = validateEnvironment(env);
    for (const issue of result.issues) {
        const line = `[ENV] ${issue.severity === 'error' ? 'ERROR' : 'WARN'} ${issue.name} ${issue.message}`;
        if (issue.severity === 'error') log.error(line);
        else log.warn(line);
    }
    if (!result.ok) {
        if (env.SKIP_ENV_VALIDATION === 'true') {
            log.error('[ENV] SKIP_ENV_VALIDATION=true: starting with an invalid configuration. Remove this override as soon as possible.');
            return result;
        }
        throw new EnvValidationError(result.issues);
    }
    if (!result.issues.length) log.log('[ENV] Environment validation passed.');
    return result;
}
