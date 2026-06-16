/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * OPMCRepository
 * --------------
 * Handles all direct database interactions for OPMC/RTOM entities.
 */
export class OPMCRepository {
    
    /**
     * Find an OPMC by ID
     */
    static async findById(id: string, tx?: any) {
        const db = tx || prisma;
        return db.oPMC.findUnique({
            where: { id }
        });
    }

    /**
     * Find an OPMC by RTOM code
     */
    static async findByRtom(rtom: string, tx?: any) {
        const db = tx || prisma;
        return db.oPMC.findFirst({
            where: {
                rtom: {
                    contains: rtom.substring(0, 4),
                    mode: 'insensitive'
                }
            }
        });
    }

    /**
     * Get all OPMCs
     */
    static async findAll(tx?: any) {
        const db = tx || prisma;
        return db.oPMC.findMany({
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Find first matching record
     */
    static async findFirst(args: Prisma.OPMCFindFirstArgs, tx?: any) {
        const db = tx || prisma;
        return db.oPMC.findFirst(args);
    }
}
