import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { ContractorQueryParams } from './contractor-types';

export class ContractorQueryService {
    /**
     * Get all contractors (Lightweight for List View)
     */
    static async getAllContractors(params: ContractorQueryParams) {
        const { opmcIds, page = 1, limit = 50 } = params;
        const where: Prisma.ContractorWhereInput = {};
        
        if (opmcIds && opmcIds.length > 0) {
            where.opmcId = { in: opmcIds };
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
                    opmc: { select: { id: true, name: true } },
                    siteOfficeStaff: { select: { id: true, name: true } },
                    _count: {
                        select: { teams: true }
                    },
                    teams: {
                        include: {
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
            if (data.nic && existing.nic === data.nic) throw new Error('NIC_ALREADY_REGISTERED');
            if (data.contactNumber && existing.contactNumber === data.contactNumber) throw new Error('CONTACT_NUMBER_ALREADY_EXISTS');
            if (data.registrationNumber && existing.registrationNumber === data.registrationNumber) throw new Error('REGISTRATION_NUMBER_ALREADY_EXISTS');
        }
    }
}
