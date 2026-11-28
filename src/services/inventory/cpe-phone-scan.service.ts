import { randomBytes } from 'node:crypto';
import { redis } from '@/lib/redis';
import { AppError } from '@/lib/error';
import { normalizeSerial } from '@/lib/cpe-serial-rules';

/**
 * Scan with the phone: the computer shows a QR code, the phone opens it and scans serials with its camera (one, or a batch), and the
 * computer picks them up. The QR carries a random token that lets the phone only add serial text to this one session for 30 minutes; the
 * person on the computer still checks and saves the serials as usual. Kept in Redis (in memory when Redis is down: one server process).
 */
export type PhoneScanMode = 'single' | 'batch';
interface Session { userId: string; label: string; mode: PhoneScanMode; createdAt: number; closed: boolean; items: string[] }

const TTL_SECONDS = 30 * 60;
const MAX_ITEMS = 500;
const key = (t: string) => `cpe-phone-scan:${t}`;
const memory = new Map<string, Session>();

async function redisReady(): Promise<boolean> {
    try {
        if (redis.status === 'wait' || redis.status === 'end' || redis.status === 'close') await redis.connect().catch(() => undefined);
        return redis.status === 'ready';
    } catch {
        return false;
    }
}

async function read(token: string): Promise<Session | null> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
    if (await redisReady()) {
        const raw = await redis.get(key(token)).catch(() => null);
        if (raw) return JSON.parse(raw) as Session;
    }
    const m = memory.get(token);
    if (m && Date.now() - m.createdAt > TTL_SECONDS * 1000) { memory.delete(token); return null; }
    return m ?? null;
}

async function write(token: string, s: Session) {
    const left = Math.max(1, TTL_SECONDS - Math.floor((Date.now() - s.createdAt) / 1000));
    if (await redisReady()) {
        const ok = await redis.set(key(token), JSON.stringify(s), 'EX', left).then(() => true).catch(() => false);
        if (ok) { memory.delete(token); return; }
    }
    memory.set(token, s);
}

export class CpePhoneScanService {
    static async create(userId: string, input: { label?: unknown; mode?: unknown }) {
        const token = randomBytes(24).toString('base64url');
        const mode: PhoneScanMode = input.mode === 'batch' ? 'batch' : 'single';
        const label = String(input.label ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80) || 'CPE serial';
        await write(token, { userId, label, mode, createdAt: Date.now(), closed: false, items: [] });
        return { token, mode, label, expiresInSeconds: TTL_SECONDS };
    }

    /** The computer reads what the phone sent, from position `after` on. Only the person who opened the session may read it. */
    static async poll(userId: string, token: string, after: number) {
        const s = await read(token);
        if (!s || s.userId !== userId) throw AppError.notFound('This phone scan has ended; open it again');
        const from = Math.max(0, Math.floor(after) || 0);
        return { items: s.items.slice(from), total: s.items.length, closed: s.closed };
    }

    static async close(userId: string, token: string) {
        const s = await read(token);
        if (!s || s.userId !== userId) return { closed: true };
        s.closed = true;
        await write(token, s);
        return { closed: true };
    }

    /** What the phone page shows. The token is the only key: no user name or other data is returned. */
    static async info(token: string) {
        const s = await read(token);
        if (!s) throw AppError.notFound('This scan link has expired. Open "Scan with phone" again on the computer.');
        return { label: s.label, mode: s.mode, closed: s.closed || (s.mode === 'single' && s.items.length > 0), items: s.items };
    }

    /** The phone adds serials. A serial already in the session is ignored; a single-serial session takes one and ends. */
    static async add(token: string, raw: unknown) {
        const s = await read(token);
        if (!s) throw AppError.notFound('This scan link has expired. Open "Scan with phone" again on the computer.');
        if (s.closed || (s.mode === 'single' && s.items.length > 0)) throw AppError.conflict('This scan is finished on the computer');
        const list = (Array.isArray(raw) ? raw : [raw]).slice(0, 50).map((v) => normalizeSerial(v)).filter((v) => v && v.length <= 64);
        const added: string[] = [];
        for (const serial of list) {
            if (s.items.includes(serial) || s.items.length >= MAX_ITEMS) continue;
            s.items.push(serial);
            added.push(serial);
            if (s.mode === 'single') break;
        }
        await write(token, s);
        return { added, total: s.items.length, closed: s.mode === 'single' && s.items.length > 0 };
    }
}
