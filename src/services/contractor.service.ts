import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NotificationService } from './notification.service';

export class ContractorService {

    /**
     * Get all contractors with full details (Teams, Members, OPMC, Stores)
     */
    static async getAllContractors(opmcIds?: string[]) {
        const where: any = {};
        if (opmcIds && opmcIds.length > 0) {
            where.opmcId = { in: opmcIds };
        }

        return await prisma.contractor.findMany({
            where,
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
            } as any,
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Generate a unique registration link for a contractor
     */
    static async generateRegistrationLink(data: { name: string, contactNumber: string, email?: string, type: string, siteOfficeStaffId: string, opmcId?: string, origin: string }) {
        const { name, contactNumber, email, type, siteOfficeStaffId, origin } = data;
        let { opmcId } = data;

        // Check for duplicates by contactNumber
        const existing = await prisma.contractor.findFirst({
            where: { contactNumber }
        });
        if (existing) throw new Error('CONTRACTOR_ALREADY_EXISTS');

        // If OPMC not provided, derive from staff
        if (!opmcId) {
            const staff = await prisma.user.findUnique({
                where: { id: siteOfficeStaffId },
                include: { accessibleOpmcs: { select: { id: true } } }
            });
            opmcId = staff?.accessibleOpmcs?.[0]?.id || undefined;
        }

        const token = require('crypto').randomUUID();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 7);

        const contractor = await prisma.contractor.create({
            data: {
                name,
                contactNumber,
                email,
                type,
                status: 'PENDING',
                registrationToken: token,
                registrationTokenExpiry: expiry,
                siteOfficeStaffId,
                opmcId
            } as any
        });

        return {
            contractor,
            registrationLink: `${origin}/contractor-registration/${token}`
        };
    }

    /**
     * Resend or regenerate a registration link for an existing contractor
     */
    static async resendRegistrationLink(id: string, origin: string) {
        const contractor = await prisma.contractor.findUnique({
            where: { id }
        }) as any;

        if (!contractor) throw new Error('CONTRACTOR_NOT_FOUND');
        if (contractor.status !== 'PENDING') throw new Error('CONTRACTOR_NOT_PENDING');

        let token = contractor.registrationToken;
        let expiry = contractor.registrationTokenExpiry;

        // If no token or expired, generate a new one
        if (!token || !expiry || new Date(expiry) < new Date()) {
            token = require('crypto').randomUUID();
            expiry = new Date();
            expiry.setDate(expiry.getDate() + 7);

            await prisma.contractor.update({
                where: { id },
                data: {
                    registrationToken: token,
                    registrationTokenExpiry: expiry
                } as any
            });
        }

        return {
            contractor,
            registrationLink: `${origin}/contractor-registration/${token}`
        };
    }

    /**
     * Get contractor by registration token (with expiry check)
     */
    static async getContractorByToken(token: string) {
        const contractor = await prisma.contractor.findFirst({
            where: { registrationToken: token } as any
        }) as any;

        if (!contractor) throw new Error('INVALID_TOKEN');

        // Expiry check
        if (contractor.registrationTokenExpiry && new Date(contractor.registrationTokenExpiry) < new Date()) {
            throw new Error('TOKEN_EXPIRED');
        }

        // Handle First Access - Start the 3-day clock
        if (!contractor.registrationStartedAt && contractor.status === 'PENDING') {
            const now = new Date();
            const expiry = new Date();
            expiry.setDate(now.getDate() + 3); // Link active for 3 days from first access

            return await prisma.contractor.update({
                where: { id: contractor.id },
                data: {
                    registrationStartedAt: now,
                    registrationTokenExpiry: expiry
                } as any
            });
        }

        return contractor;
    }

    /**
     * Save partial registration data as draft
     */
    static async saveRegistrationDraft(token: string, draftData: any) {
        const contractor = await this.getContractorByToken(token);
        return await prisma.contractor.update({
            where: { id: contractor.id },
            data: { registrationDraft: draftData } as any
        });
    }

    /**
     * Submit public registration data
     */
    static async submitPublicRegistration(token: string, data: any) {
        const contractor = await this.getContractorByToken(token);

        const { teams, id: _id, createdAt: _c, updatedAt: _u, ...restData } = data;

        // 1. Update Contractor Basic Details
        const updated = await prisma.contractor.update({
            where: { id: contractor.id },
            data: {
                name: restData.name,
                email: restData.email,
                nic: restData.nic,
                address: restData.address,
                contactNumber: restData.contactNumber,
                brNumber: restData.brNumber,
                bankName: restData.bankName,
                bankBranch: restData.bankBranch,
                bankAccountNumber: restData.bankAccountNumber,
                bankPassbookUrl: restData.bankPassbookUrl,
                photoUrl: restData.photoUrl,
                nicFrontUrl: restData.nicFrontUrl,
                nicBackUrl: restData.nicBackUrl,
                policeReportUrl: restData.policeReportUrl,
                gramaCertUrl: restData.gramaCertUrl,
                brCertUrl: restData.brCertUrl,
                status: 'ARM_PENDING' as any,
                registrationToken: null,
                registrationTokenExpiry: null,
                registrationDraft: null,
                registrationStartedAt: null,
            } as any
        });

        // 2. Notify Relevant Staff (Generator and OPMC Admins)
        try {
            const message = `Contractor "${updated.name}" has submitted their registration form and is waiting for ARM review.`;

            // Notify the person who generated the link
            if (updated.siteOfficeStaffId) {
                await NotificationService.send({
                    userId: updated.siteOfficeStaffId,
                    title: "New Contractor Submission",
                    message,
                    type: 'CONTRACTOR',
                    priority: 'HIGH',
                    link: `/admin/contractors`
                });
            }

            // Also notify ARMs and Admins in the same OPMC
            await NotificationService.notifyByRole({
                roles: ['SUPER_ADMIN', 'ADMIN', 'AREA_MANAGER', 'OFFICE_ADMIN'],
                title: "Contractor Pending Review",
                message,
                type: 'CONTRACTOR',
                priority: 'MEDIUM',
                link: `/admin/contractors`,
                opmcId: updated.opmcId || undefined
            });
        } catch (nErr) {
            console.error("Failed to send submission notifications:", nErr);
        }

        // 3. Create Teams and Members
        if (teams && teams.length > 0) {
            for (const team of teams) {
                const createdTeam = await prisma.contractorTeam.create({
                    data: {
                        name: team.name,
                        contractorId: contractor.id,
                        storeAssignments: team.primaryStoreId ? {
                            create: {
                                storeId: team.primaryStoreId,
                                isPrimary: true
                            }
                        } : undefined,
                        members: {
                            create: (team.members || []).map((m: any) => ({
                                name: m.name,
                                nic: m.nic || '',
                                contactNumber: m.contactNumber || '',
                                designation: m.designation || '',
                                photoUrl: m.photoUrl || '',
                                passportPhotoUrl: m.passportPhotoUrl || '', // Mandatory for ID
                                nicUrl: m.nicUrl || '',
                                idCopyNumber: m.idCopyNumber || '',
                                contractorId: contractor.id
                            }))
                        }
                    }
                });
            }
        }

        return updated;
    }

    /**
     * Create a new contractor with optional initial teams
     */
    static async createContractor(data: any) {
        // Validate required fields
        if (!data.name || !data.registrationNumber) {
            throw new Error('NAME_AND_REGISTRATION_REQUIRED');
        }

        const { teams = [], ...contractorData } = data;

        // 1. Create Contractor
        const contractor = await prisma.contractor.create({
            data: {
                name: contractorData.name,
                address: contractorData.address,
                registrationNumber: contractorData.registrationNumber,
                brNumber: contractorData.brNumber,
                status: (contractorData.status || 'PENDING') as any,
                type: contractorData.type || 'SOD',
                registrationFeePaid: contractorData.registrationFeePaid,
                agreementSigned: contractorData.agreementSigned,
                agreementDate: contractorData.agreementDate ? new Date(contractorData.agreementDate) : null,
                agreementDuration: contractorData.agreementDuration ? parseInt(String(contractorData.agreementDuration)) : 1,
                contactNumber: contractorData.contactNumber,
                nic: contractorData.nic,
                brCertUrl: contractorData.brCertUrl,
                bankAccountNumber: contractorData.bankAccountNumber,
                bankBranch: contractorData.bankBranch,
                bankName: contractorData.bankName,
                bankPassbookUrl: contractorData.bankPassbookUrl,
                photoUrl: contractorData.photoUrl,
                nicFrontUrl: contractorData.nicFrontUrl,
                nicBackUrl: contractorData.nicBackUrl,
                policeReportUrl: contractorData.policeReportUrl,
                gramaCertUrl: contractorData.gramaCertUrl,
                opmcId: contractorData.opmcId,
                siteOfficeStaffId: contractorData.siteOfficeStaffId,
                registrationToken: contractorData.registrationToken,
                registrationTokenExpiry: contractorData.registrationTokenExpiry
            } as any
        });

        // 2. Create Teams & Members (if any)
        if (teams.length > 0) {
            for (const team of teams) {
                await prisma.contractorTeam.create({
                    data: {
                        name: team.name,
                        contractorId: contractor.id,
                        opmcId: team.opmcId || null,
                        storeAssignments: team.storeIds && team.storeIds.length > 0 ? {
                            create: team.storeIds.map((storeId: string) => ({
                                storeId,
                                isPrimary: storeId === team.primaryStoreId
                            }))
                        } : undefined,
                        members: {
                            create: team.members.map((m: any) => ({
                                name: m.name,
                                nic: m.nic || m.idCopyNumber || '', // Backwards compatibility
                                idCopyNumber: m.idCopyNumber || '',
                                contractorIdCopyNumber: m.contractorIdCopyNumber || '',
                                designation: m.designation || '',
                                contactNumber: m.contactNumber || '',
                                photoUrl: m.photoUrl || '',
                                passportPhotoUrl: m.passportPhotoUrl || '',
                                contractorId: contractor.id
                            }))
                        }
                    }
                });
            }
        }

        return contractor;
    }

    /**
     * Update an existing contractor (including full Team Sync)
     */
    static async updateContractor(id: string, data: any) {
        if (!id) throw new Error('ID_REQUIRED');

        // Exclude ID from data to prevent update attempts on the primary key
        const { teams, id: _removeId, ...contractorData } = data;

        // 1. Update Basic Details
        const updated = await prisma.contractor.update({
            where: { id },
            data: {
                name: contractorData.name,
                address: contractorData.address,
                registrationNumber: contractorData.registrationNumber,
                brNumber: contractorData.brNumber,
                status: contractorData.status ? (contractorData.status as any) : undefined,
                registrationFeePaid: contractorData.registrationFeePaid !== undefined ? Boolean(contractorData.registrationFeePaid) : undefined,
                agreementSigned: contractorData.agreementSigned !== undefined ? Boolean(contractorData.agreementSigned) : undefined,
                agreementDate: contractorData.agreementDate ? new Date(contractorData.agreementDate) : null,
                agreementDuration: contractorData.agreementDuration ? parseInt(String(contractorData.agreementDuration)) : undefined,
                brCertUrl: contractorData.brCertUrl,
                contactNumber: contractorData.contactNumber,
                nic: contractorData.nic,
                bankAccountNumber: contractorData.bankAccountNumber,
                bankBranch: contractorData.bankBranch,
                bankName: contractorData.bankName,
                bankPassbookUrl: contractorData.bankPassbookUrl,
                photoUrl: contractorData.photoUrl,
                nicFrontUrl: contractorData.nicFrontUrl,
                nicBackUrl: contractorData.nicBackUrl,
                policeReportUrl: contractorData.policeReportUrl,
                gramaCertUrl: contractorData.gramaCertUrl,
                opmcId: contractorData.opmcId,
                documentStatus: contractorData.documentStatus,
                armApprovedAt: contractorData.armApprovedAt,
                armApprovedById: contractorData.armApprovedById,
                ospApprovedAt: contractorData.ospApprovedAt,
                ospApprovedById: contractorData.ospApprovedById
            } as any
        });

        // 2. Full Team Sync (if teams array is provided)
        if (teams) {
            const existingTeams = await prisma.contractorTeam.findMany({
                where: { contractorId: id },
                select: { id: true }
            });
            const existingTeamIds = existingTeams.map(t => t.id);
            const incomingTeamIds = teams.filter((t: any) => t.id).map((t: any) => t.id);

            // Delete removed teams
            const teamsToDelete = existingTeamIds.filter(tid => !incomingTeamIds.includes(tid));
            if (teamsToDelete.length > 0) {
                await prisma.contractorTeam.deleteMany({ where: { id: { in: teamsToDelete } } });
                await prisma.teamMember.deleteMany({ where: { teamId: { in: teamsToDelete } } });
            }

            // Upsert teams
            for (const team of teams) {
                if (team.id && existingTeamIds.includes(team.id)) {
                    // UPDATE
                    await prisma.contractorTeam.update({
                        where: { id: team.id },
                        data: {
                            name: team.name,
                            opmcId: team.opmcId || null,
                            storeAssignments: {
                                deleteMany: {},
                                create: team.storeIds?.map((storeId: string) => ({
                                    storeId,
                                    isPrimary: storeId === team.primaryStoreId
                                }))
                            }
                        }
                    });

                    // Sync Members (Replace for simplicity)
                    await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
                    if (team.members && team.members.length > 0) {
                        await prisma.teamMember.createMany({
                            data: team.members.map((m: any) => ({
                                name: m.name,
                                nic: m.nic || m.idCopyNumber || '',
                                idCopyNumber: m.idCopyNumber || '',
                                contractorIdCopyNumber: m.contractorIdCopyNumber || '',
                                designation: m.designation || '',
                                contactNumber: m.contactNumber || '',
                                photoUrl: m.photoUrl || '',
                                passportPhotoUrl: m.passportPhotoUrl || '',
                                contractorId: id,
                                teamId: team.id
                            }))
                        });
                    }

                } else {
                    // CREATE
                    await prisma.contractorTeam.create({
                        data: {
                            name: team.name,
                            contractorId: id,
                            opmcId: team.opmcId || null,
                            storeAssignments: {
                                create: team.storeIds?.map((storeId: string) => ({
                                    storeId,
                                    isPrimary: storeId === team.primaryStoreId
                                }))
                            },
                            members: {
                                create: team.members.map((m: any) => ({
                                    name: m.name,
                                    nic: m.nic || m.idCopyNumber || '',
                                    idCopyNumber: m.idCopyNumber || '',
                                    contractorIdCopyNumber: m.contractorIdCopyNumber || '',
                                    designation: m.designation || '',
                                    contactNumber: m.contactNumber || '',
                                    photoUrl: m.photoUrl || '',
                                    passportPhotoUrl: m.passportPhotoUrl || '',
                                    contractorId: id
                                }))
                            }
                        }
                    });
                }
            }
        }

        return updated;
    }

    /**
     * Delete a contractor
     */
    static async deleteContractor(id: string) {
        if (!id) throw new Error('ID_REQUIRED');
        return await prisma.contractor.delete({ where: { id } });
    }
}
