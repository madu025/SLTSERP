import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ContractorQueryParams } from '@/types/contractor/contractor.types';
import { ROLE_GROUPS } from '@/config/roles';
import { NIL_UUID } from '@/lib/opmc-scope';

export class ContractorQueryService {
    /**
     * Get all contractors (Lightweight for List View)
     */
    static async getAllContractors(params: ContractorQueryParams) {
        const { opmcIds: clientOpmcIds, page = 1, limit = 50, userId, userRole } = params;

        const where: Prisma.ContractorWhereInput = {};

        // Tri-state OPMC isolation (mirrors the sod.query.service F1 fix):
        //  - admin tier          → unrestricted (client filter honoured as-is)
        //  - non-admin + scope   → restricted to accessibleOpmcs
        //  - non-admin + empty   → DENY ALL (previously `[]` returned ALL rows)
        const isAdmin = !!userRole && ROLE_GROUPS.ADMINS.includes(userRole);

        if (!isAdmin) {
            let accessible: { id: string; rtom: string }[] = [];
            if (userId) {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    include: { accessibleOpmcs: { select: { id: true, rtom: true } } }
                });
                if (user) {
                    accessible = user.accessibleOpmcs;
                }
            }

            // Intersect any client-supplied rtomId/opmcId with the resolved
            // scope — values outside it are ignored (deny, never escalate).
            // Client values may be UUIDs or RTOM codes (e.g. 'R-KX').
            let scopedIds = accessible.map(o => o.id);
            if (clientOpmcIds && clientOpmcIds.length > 0) {
                scopedIds = clientOpmcIds
                    .map(v => accessible.find(o => o.id === v || o.rtom.toLowerCase() === v.toLowerCase())?.id)
                    .filter((id): id is string => !!id);
            }

            where.opmcId = scopedIds.length > 0 ? { in: scopedIds } : NIL_UUID;
        } else if (clientOpmcIds && clientOpmcIds.length > 0) {
            where.opmcId = { in: clientOpmcIds };
        }

        const skip = (page - 1) * limit;

        const [total, contractors] = await Promise.all([
            prisma.contractor.count({ where }),
            prisma.contractor.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    registrationNumber: true,
                    contactNumber: true,
                    email: true,
                    nic: true,
                    address: true,
                    brNumber: true,
                    brCertUrl: true,
                    type: true,
                    status: true,
                    registrationFeePaid: true,
                    agreementSigned: true,
                    agreementDate: true,
                    agreementDuration: true,
                    bankName: true,
                    bankAccountNumber: true,
                    bankBranch: true,
                    bankPassbookUrl: true,
                    photoUrl: true,
                    nicFrontUrl: true,
                    nicBackUrl: true,
                    policeReportUrl: true,
                    gramaCertUrl: true,
                    documentStatus: true,
                    armApprovedAt: true,
                    ospApprovedAt: true,
                    createdAt: true,
                    updatedAt: true,
                    opmc: { select: { id: true, name: true, rtom: true, region: true, province: true } },
                    siteOfficeStaff: { select: { id: true, name: true } },
                    _count: {
                        select: { teams: true }
                    },
                    teams: {
                        include: {
                            opmc: { select: { id: true, name: true, rtom: true, region: true, province: true } },
                            members: true,
                            storeAssignments: {
                                include: { store: true }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            })
        ]);

        return {
            contractors,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get full contractor details (for Detail View)
     */
    static async getContractorById(id: string) {
        return await prisma.contractor.findUnique({
            where: { id },
            include: {
                opmc: { select: { id: true, name: true } },
                siteOfficeStaff: { select: { id: true, name: true, role: true } },
                teams: {
                    include: {
                        opmc: { select: { id: true, name: true } },
                        members: true,
                        storeAssignments: {
                            include: {
                                store: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Helper to validate uniqueness of sensitive fields
     */
    static async validateUnique(data: { nic?: string, contactNumber?: string, registrationNumber?: string }, excludeId?: string) {
        const orFilters: Prisma.ContractorWhereInput[] = [];
        if (data.nic) orFilters.push({ nic: data.nic });
        if (data.contactNumber) orFilters.push({ contactNumber: data.contactNumber });
        if (data.registrationNumber) orFilters.push({ registrationNumber: data.registrationNumber });

        if (orFilters.length === 0) return;

        const existing = await prisma.contractor.findFirst({
            where: {
                OR: orFilters,
                NOT: excludeId ? { id: excludeId } : undefined
            }
        });

        if (existing) {
            if (data.nic && existing.nic === data.nic) throw AppError.badRequest('NIC_ALREADY_REGISTERED');
            if (data.contactNumber && existing.contactNumber === data.contactNumber) throw AppError.badRequest('CONTACT_NUMBER_ALREADY_EXISTS');
            if (data.registrationNumber && existing.registrationNumber === data.registrationNumber) throw AppError.badRequest('REGISTRATION_NUMBER_ALREADY_EXISTS');
        }
    }

    /**
     * Get all contractor teams
     */
    static async getAllTeams() {
        return await prisma.contractorTeam.findMany({
            select: {
                id: true,
                name: true,
                contractorId: true,
                contractor: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { name: 'asc' }
        });
    }

    /**
     * Get team's assigned stores
     */
    static async getTeamStores(teamId: string) {
        return await prisma.contractorTeam.findUnique({
            where: { id: teamId },
            include: {
                storeAssignments: {
                    include: {
                        store: {
                            include: {
                                opmcs: {
                                    select: {
                                        id: true,
                                        name: true,
                                        rtom: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
}
