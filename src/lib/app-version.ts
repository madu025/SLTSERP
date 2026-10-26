import packageJson from '../../package.json';

const FALLBACK_BUILD_ID = 'local';

function shortSha(value: string | undefined) {
    if (!value) return FALLBACK_BUILD_ID;
    return value.slice(0, 8);
}

/**
 * The web release identity is derived from the package version plus the
 * deployment commit. Vercel supplies VERCEL_GIT_COMMIT_SHA automatically, so
 * every deployed update gets a new, traceable version without a manual DB row.
 */
export function getWebVersion() {
    const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA;
    const build = shortSha(commitSha);
    const baseVersion = packageJson.version;

    return {
        baseVersion,
        build,
        commitSha: commitSha || null,
        displayVersion: `v${baseVersion}+${build}`,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    };
}
