import fs from 'fs';
import path from 'path';
import os from 'os';
import { prisma } from '@/lib/prisma';

const CONFIG_FILE = path.join(process.cwd(), 'src/data/slt-config.json');
const TMP_CONFIG_FILE = path.join(os.tmpdir(), 'slt-config.json');

export class SLTPortalAuthService {
    static async getOrRefreshCookie(): Promise<string> {
        // 1. Check if we have a saved cookie from DB or file
        let sltCookie = '';

        try {
            const setting = await prisma.systemSetting.findUnique({
                where: { key: 'SLT_PORTAL_COOKIE' }
            });
            if (setting && typeof setting.value === 'object' && setting.value !== null) {
                sltCookie = (setting.value as { cookie?: string }).cookie || '';
            }
        } catch (dbErr) {
            console.warn('[SLT-AUTH] Failed to read cookie from DB:', dbErr);
        }

        if (!sltCookie) {
            // Fallback to local or /tmp file
            const targetFile = fs.existsSync(CONFIG_FILE) ? CONFIG_FILE : TMP_CONFIG_FILE;
            if (fs.existsSync(targetFile)) {
                try {
                    const config = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
                    sltCookie = config.cookie || '';
                } catch (e) {
                    console.error('[SLT-AUTH] Failed to read slt-config file:', e);
                }
            }
        }

        // 2. Verify if the cookie is still active
        if (sltCookie) {
            const isCookieActive = await this.verifyCookie(sltCookie);
            if (isCookieActive) {
                return sltCookie;
            }
            console.log('[SLT-AUTH] Saved SLT cookie has expired. Attempting auto-login...');
        }

        // 3. Cookie is expired or missing. Attempt auto-login using .env credentials
        const username = process.env.SLT_PORTAL_USERNAME;
        const password = process.env.SLT_PORTAL_PASSWORD;
        const usertype = process.env.SLT_PORTAL_USERTYPE || 'contr';

        if (!username || !password) {
            console.log('[SLT-AUTH] No SLT portal credentials in .env. Auto-login skipped.');
            return sltCookie;
        }

        try {
            console.log(`[SLT-AUTH] Logging in to SLT Portal as ${username}...`);
            const params = new URLSearchParams();
            params.append('username', username);
            params.append('password', password);
            params.append('usertype', usertype);

            const res = await fetch('https://serviceportal.slt.lk/iShamp/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                body: params.toString(),
                redirect: 'manual'
            });

            // Parse Set-Cookie header using Next.js Headers.getSetCookie() method
            const setCookieHeaders = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
            let sessionCookie = '';

            for (const c of setCookieHeaders) {
                if (c.startsWith('PHPSESSID=')) {
                    sessionCookie = c.split(';')[0];
                    break;
                }
            }

            if (!sessionCookie) {
                const rawCookie = res.headers.get('set-cookie');
                if (rawCookie) {
                    const match = rawCookie.match(/PHPSESSID=[^;]+/);
                    if (match) {
                        sessionCookie = match[0];
                    }
                }
            }

            if (sessionCookie) {
                console.log('[SLT-AUTH] Successfully logged in! New PHPSESSID obtained.');

                // Save to Database (Serverless safe)
                try {
                    await prisma.systemSetting.upsert({
                        where: { key: 'SLT_PORTAL_COOKIE' },
                        update: { value: { cookie: sessionCookie } },
                        create: { key: 'SLT_PORTAL_COOKIE', value: { cookie: sessionCookie } }
                    });
                } catch (dbSaveErr) {
                    console.warn('[SLT-AUTH] Could not save cookie to DB:', dbSaveErr);
                }

                // Best-effort file save to /tmp if writable
                try {
                    fs.writeFileSync(TMP_CONFIG_FILE, JSON.stringify({ cookie: sessionCookie }, null, 2), 'utf-8');
                } catch {
                    // Ignore EROFS in serverless environments
                }

                return sessionCookie;
            } else {
                console.error('[SLT-AUTH] Login request completed but no PHPSESSID cookie was returned.');
            }
        } catch (error) {
            console.error('[SLT-AUTH] SLT Portal Auto-Login Failed:', error);
        }

        return sltCookie;
    }

    private static async verifyCookie(cookie: string): Promise<boolean> {
        try {
            const res = await fetch('https://serviceportal.slt.lk/iShamp/contr/dynamic_load?x=ftthbomload&z=SLTS', {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (!res.ok) return false;
            const text = await res.text();
            if (text.includes('login') || text.includes('Username') || text.includes('Password')) {
                return false;
            }
            return true;
        } catch {
            return false;
        }
    }
}
