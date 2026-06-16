/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * AuditRepository
 * ---------------
 * Handles database interactions for audit logs.
 */
export class AuditRepository {
    static async create(data: Prisma.AuditLogUncheckedCreateInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).auditLog.create({ data });
    }

    static async findMany(args: Prisma.AuditLogFindManyArgs, tx?: any) {
        const client = tx || prisma;
        return (client as any).auditLog.findMany(args);
    }

    static async count(args: Prisma.AuditLogCountArgs, tx?: any) {
        const client = tx || prisma;
        return (client as any).auditLog.count(args);
    }

    static async deleteMany(where: Prisma.AuditLogWhereInput, tx?: any) {
        const client = tx || prisma;
        return (client as any).auditLog.deleteMany({ where });
    }
}
