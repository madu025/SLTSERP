import { gzipSync } from 'node:zlib';
import { prisma } from '@/lib/prisma';
import { StorageService } from '@/services/storage/storage.service';

/**
 * Audit log retention: rows stay online for AUDIT_RETENTION_MONTHS (default 24, never below 12). Older rows are
 * written to a gzipped JSON-lines archive in object storage first and only deleted after that upload succeeded,
 * so nothing is lost and the AuditLog table stops growing without bound.
 */
export const MIN_RETENTION_MONTHS = 12;
export const DEFAULT_RETENTION_MONTHS = 24;
const BATCH_SIZE = 5000;
const MAX_BATCHES_PER_RUN = 20;

export function retentionMonths(raw: string | undefined = process.env.AUDIT_RETENTION_MONTHS): number {
    const n = Number.parseInt(raw ?? '', 10);
    return Number.isInteger(n) && n >= MIN_RETENTION_MONTHS ? Math.min(n, 120) : DEFAULT_RETENTION_MONTHS;
}

export function retentionCutoff(now: Date, months: number): Date {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - months);
    return d;
}

export function toJsonLines(rows: Array<Record<string, unknown>>): string {
    return rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

export class AuditRetentionService {
    static async archiveAndPurge(now = new Date()): Promise<{ archived: number; batches: number; cutoff: string }> {
        const cutoff = retentionCutoff(now, retentionMonths());
        let archived = 0;
        let batches = 0;
        for (; batches < MAX_BATCHES_PER_RUN; batches++) {
            const rows = await prisma.auditLog.findMany({ where: { createdAt: { lt: cutoff } }, orderBy: { createdAt: 'asc' }, take: BATCH_SIZE });
            if (rows.length === 0) break;
            const first = rows[0].createdAt.toISOString().slice(0, 10);
            const last = rows[rows.length - 1].createdAt.toISOString().slice(0, 10);
            const body = gzipSync(Buffer.from(toJsonLines(rows as unknown as Array<Record<string, unknown>>), 'utf8'));
            // Archive first; a failed upload throws here and leaves every row in place
            await StorageService.uploadFile({
                fileBuffer: body,
                fileName: `audit-${first}_${last}-${rows[0].id}.jsonl.gz`,
                mimeType: 'application/gzip',
                folder: 'audit-archive',
            });
            await prisma.auditLog.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
            archived += rows.length;
        }
        return { archived, batches, cutoff: cutoff.toISOString() };
    }
}
