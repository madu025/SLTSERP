import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'src/data/slt-config.json');

export class SLTPortalAuthService {
    static async getOrRefreshCookie(): Promise<string> {
        // 1. Check if we have a saved cookie
        let sltCookie = '';
        if (fs.existsSync(CONFIG_FILE)) {
            try {
                const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
                sltCookie = config.cookie || '';
            } catch (e) {
                console.error('Failed to read slt-config:', e);
            }
        }

        // 2. Verify if the cookie is still active
        if (sltCookie) {
            const isCookieActive = await this.verifyCookie(sltCookie);
            if (isCookieActive) {
                return sltCookie;
            }
            console.log('Saved SLT cookie has expired. Attempting auto-login...');
        }

        // 3. Cookie is expired or missing. Attempt auto-login using .env credentials
        const username = process.env.SLT_PORTAL_USERNAME;
        const password = process.env.SLT_PORTAL_PASSWORD;
        const usertype = process.env.SLT_PORTAL_USERTYPE || 'contr';

        if (!username || !password) {
            console.log('No SLT portal credentials in .env. Auto-login skipped.');
            return sltCookie; // Fallback to whatever expired cookie we have
        }

        try {
            console.log(`Logging in to SLT Portal as ${username}...`);
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

            // Fallback for older environments or direct headers parsing
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
                console.log('Successfully logged in! New PHPSESSID obtained.');
                
                // Ensure directory exists
                const dir = path.dirname(CONFIG_FILE);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }

                // Save new cookie
                fs.writeFileSync(CONFIG_FILE, JSON.stringify({ cookie: sessionCookie }, null, 2), 'utf-8');
                return sessionCookie;
            } else {
                console.error('Login request completed but no PHPSESSID cookie was returned.');
            }
        } catch (error) {
            console.error('SLT Portal Auto-Login Failed:', error);
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
