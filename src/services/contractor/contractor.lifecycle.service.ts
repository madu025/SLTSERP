import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { ContractorType, ContractorStatus } from '@prisma/client';
import { emitSystemEvent } from '@/lib/events';
import { ContractorUpdateData, TeamInput, TeamMemberInput } from './contractor-types';
import { ContractorQueryService } from './contractor.query.service';
import { ContractorRepository } from '@/repositories/contractor.repository';
import { TransactionClient } from '../inventory/types';
import { eventBus } from '@/lib/events/event-bus';

export class ContractorLifecycleService {
    /**
     * Create a new contractor (Admin Flow)
     */
    static async createContractor(data: ContractorUpdateData) {
        if (!data.name) {
            throw AppError.badRequest('NAME_REQUIRED');
        }

        await ContractorQueryService.validateUnique({
            nic: data.nic,
            contactNumber: data.contactNumber,
            registrationNumber: data.registrationNumber || undefined
        });

        const { teams = [], ...contractorData } = data;

        return await prisma.$transaction(async (tx: TransactionClient) => {
            const contractor = await ContractorRepository.create({
                name: data.name!,
                address: contractorData.address || '',
                registrationNumber: data.registrationNumber!,
                brNumber: contractorData.brNumber,
                status: (contractorData.status as ContractorStatus) || 'PENDING',
                type: (contractorData.type as ContractorType) || 'SOD',
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
                registrationFeeSlipUrl: contractorData.registrationFeeSlipUrl,
                opmcId: contractorData.opmcId || null,
                siteOfficeStaffId: contractorData.siteOfficeStaffId,
            }, tx);

            if (teams.length > 0) {
                for (const team of teams) {
                    await ContractorRepository.createTeam({
                        name: team.name,
                        contractorId: contractor.id,
                        opmcId: (team.opmcId && team.opmcId !== 'inherit') ? team.opmcId : (contractor.opmcId || null),
                        sltCode: team.sltCode,
                        storeAssignments: team.storeIds && team.storeIds.length > 0 ? {
                            create: team.storeIds.map((storeId: string) => ({
                                storeId,
                                isPrimary: storeId === team.primaryStoreId
                            }))
                        } : undefined,
                        members: {
                            create: (team.members || []).map((m: TeamMemberInput) => ({
                                name: m.name,
                                nic: m.nic || m.idCopyNumber || '',
                                idCopyNumber: m.idCopyNumber || '',
                                contractorIdCopyNumber: m.contractorIdCopyNumber || '',
                                designation: m.designation || '',
                                contactNumber: m.contactNumber || '',
                                address: m.address || '',
                                photoUrl: m.photoUrl || '',
                                passportPhotoUrl: m.passportPhotoUrl || '',
                                nicUrl: m.nicUrl || '',
                                policeReportUrl: m.policeReportUrl || '',
                                gramaCertUrl: m.gramaCertUrl || '',
                                shoeSize: m.shoeSize || '',
                                tshirtSize: m.tshirtSize || '',
                                contractorId: contractor.id
                            }))
                        }
                    }, tx);
                }
            }

            emitSystemEvent('CONTRACTOR_UPDATE');
            return contractor;
        });
    }

    /**
     * Update an existing contractor (Admin/Approval Flow)
     */
    static async updateContractor(id: string, data: ContractorUpdateData) {
        if (!id) throw AppError.badRequest('ID_REQUIRED');

        await ContractorQueryService.validateUnique({
            nic: data.nic,
            contactNumber: data.contactNumber,
            registrationNumber: data.registrationNumber
        }, id);

        const { teams, id: _removeId, ...contractorData } = data;
        void _removeId;

        return await prisma.$transaction(async (tx: TransactionClient) => {
            const current = await tx.contractor.findUnique({ where: { id } });
            if (!current) throw AppError.badRequest('CONTRACTOR_NOT_FOUND');

            let registrationNumber = contractorData.registrationNumber;

            // AUTO-GENERATE SEQUENCE ON ACTIVATION
            if (contractorData.status === 'ACTIVE' && !current.registrationNumber && !registrationNumber) {
                const year = new Date().getFullYear().toString().slice(-2);
                const type = (contractorData.type || current.type || 'SOD').toUpperCase();
                
                // Count existing active contractors of same type across all SLTS to get next sequence
                const count = await tx.contractor.count({
                    where: { 
                        registrationNumber: { startsWith: `SLTS/${type}/${year}/` }
                    }
                });
                
                registrationNumber = `SLTS/${type}/${year}/${(count + 1).toString().padStart(3, '0')}`;
            }

            const updated = await ContractorRepository.update(id, {
                name: contractorData.name,
                address: contractorData.address,
                registrationNumber: registrationNumber,
                brNumber: contractorData.brNumber,
                status: (contractorData.status as ContractorStatus) || undefined,
                registrationFeePaid: contractorData.registrationFeePaid,
                agreementSigned: contractorData.agreementSigned,
                agreementDate: contractorData.agreementDate ? new Date(contractorData.agreementDate) : null,
                agreementDuration: contractorData.agreementDuration ? parseInt(String(contractorData.agreementDuration)) : undefined,
                contactNumber: contractorData.contactNumber,
                nic: contractorData.nic,
                bankName: contractorData.bankName,
                bankBranch: contractorData.bankBranch,
                bankAccountNumber: contractorData.bankAccountNumber,
                bankPassbookUrl: contractorData.bankPassbookUrl,
                opmcId: contractorData.opmcId,
                documentStatus: contractorData.documentStatus,
                registrationFeeSlipUrl: contractorData.registrationFeeSlipUrl,
                armApprovedAt: contractorData.armApprovedAt,
                armApprovedById: contractorData.armApprovedById,
                ospApprovedAt: contractorData.ospApprovedAt,
                ospApprovedById: contractorData.ospApprovedById,
                rejectionReason: contractorData.rejectionReason,
                rejectionById: contractorData.rejectionById,
                rejectedAt: contractorData.rejectedAt
            }, tx);

            if (contractorData.status) {
                await this.handleStatusChangeNotifications(updated, contractorData);
            }

            if (teams) {
                await this.syncTeams(id, teams, updated.opmcId, tx);
            }

            emitSystemEvent('CONTRACTOR_UPDATE');
            return updated;
        });
    }

    /**
     * Handle notifications on status changes
     */
    private static async handleStatusChangeNotifications(contractor: { id: string; name: string; siteOfficeStaffId: string | null; opmcId: string | null }, data: ContractorUpdateData) {
        try {
            await eventBus.publish('contractor.status_changed', {
                contractor,
                status: data.status as string,
                rejectionReason: data.rejectionReason
            });
        } catch (err) {
            console.error("[LIFECYCLE] Event Publish Failed:", err);
        }
    }

    /**
     * Sync Teams and Members
     */
    public static async syncTeams(contractorId: string, teams: TeamInput[], defaultOpmcId: string | null, tx: TransactionClient) {
        const existingTeams = await prisma.contractorTeam.findMany({
            where: { contractorId },
            select: { id: true }
        });
        const existingTeamIds = existingTeams.map(t => t.id);
        const incomingTeamIds = teams.filter(t => t.id).map(t => t.id);

        const teamsToDisable = existingTeamIds.filter(tid => !incomingTeamIds.includes(tid));
        if (teamsToDisable.length > 0) {
            await tx.contractorTeam.updateMany({
                where: { id: { in: teamsToDisable } },
                data: { status: 'INACTIVE' }
            });
        }

        for (const team of teams) {
            if (team.id && existingTeamIds.includes(team.id)) {
                await ContractorRepository.updateTeam(team.id, {
                    name: team.name,
                    opmcId: (team.opmcId && team.opmcId !== 'inherit') ? team.opmcId : (defaultOpmcId || null),
                    sltCode: team.sltCode,
                    status: 'ACTIVE', // Re-enable team if it is sent in incoming list
                    storeAssignments: {
                        deleteMany: {},
                        create: team.storeIds?.map((storeId: string) => ({
                            storeId,
                            isPrimary: storeId === team.primaryStoreId
                        }))
                    }
                }, tx);
                
                await ContractorRepository.deleteTeamMembers(team.id, tx);
                
                if (team.members && team.members.length > 0) {
                    await ContractorRepository.createTeamMembers(team.members.map((m: TeamMemberInput) => ({
                        name: m.name,
                        nic: m.nic || m.idCopyNumber || '',
                        designation: m.designation || '',
                        contactNumber: m.contactNumber || '',
                        address: m.address || '',
                        photoUrl: m.photoUrl || '',
                        passportPhotoUrl: m.passportPhotoUrl || '',
                        nicUrl: m.nicUrl || '',
                        policeReportUrl: m.policeReportUrl || '',
                        gramaCertUrl: m.gramaCertUrl || '',
                        shoeSize: m.shoeSize || '',
                        tshirtSize: m.tshirtSize || '',
                        idCopyNumber: m.idCopyNumber || m.nic || '',
                        contractorId,
                        teamId: team.id
                    })), tx);
                }
            } else {
                await ContractorRepository.createTeam({
                    name: team.name,
                    contractorId,
                    opmcId: (team.opmcId && team.opmcId !== 'inherit') ? team.opmcId : (defaultOpmcId || null),
                    sltCode: team.sltCode,
                    storeAssignments: {
                        create: team.storeIds?.map((storeId: string) => ({
                            storeId,
                            isPrimary: storeId === team.primaryStoreId
                        }))
                    },
                    members: {
                        create: (team.members || []).map((m: TeamMemberInput) => ({
                            name: m.name,
                            nic: m.nic || m.idCopyNumber || '',
                            designation: m.designation || '',
                            contactNumber: m.contactNumber || '',
                            address: m.address || '',
                            photoUrl: m.photoUrl || '',
                            passportPhotoUrl: m.passportPhotoUrl || '',
                            nicUrl: m.nicUrl || '',
                            policeReportUrl: m.policeReportUrl || '',
                            gramaCertUrl: m.gramaCertUrl || '',
                            shoeSize: m.shoeSize || '',
                            tshirtSize: m.tshirtSize || '',
                            idCopyNumber: m.idCopyNumber || m.nic || '',
                            contractorId
                        }))
                    }
                }, tx);
            }
        }
    }

    /**
     * Delete a contractor (or soft-deactivate if contractor has historical Service Orders, Invoices, or Projects)
     */
    static async deleteContractor(id: string) {
        if (!id) throw AppError.badRequest('ID_REQUIRED');
        
        const contractor = await prisma.contractor.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                _count: {
                    select: { serviceOrders: true, projects: true, stock: true, invoices: true, teams: true }
                }
            }
        });

        if (!contractor) {
            throw AppError.notFound('Contractor not found');
        }

        const { serviceOrders, projects, stock, invoices } = contractor._count;
        const totalRelated = serviceOrders + projects + stock + invoices;

        if (totalRelated > 0) {
            // Soft Delete / Inactivate to preserve audit trail and service records
            const updated = await prisma.contractor.update({
                where: { id },
                data: { status: 'INACTIVE' }
            });
            emitSystemEvent('CONTRACTOR_UPDATE');
            return {
                softDeleted: true,
                message: `Contractor '${contractor.name}' has ${serviceOrders} Service Order(s) and ${invoices} Invoice(s). Status updated to INACTIVE to preserve audit records.`,
                contractor: updated
            };
        }

        // Hard Delete for fresh/empty contractors
        return await prisma.$transaction(async (tx) => {
            // Delete child teams and team members first
            const teams = await tx.contractorTeam.findMany({ where: { contractorId: id }, select: { id: true } });
            const teamIds = teams.map(t => t.id);
            if (teamIds.length > 0) {
                await tx.teamMember.deleteMany({ where: { teamId: { in: teamIds } } });
                await tx.teamStoreAssignment.deleteMany({ where: { teamId: { in: teamIds } } });
                await tx.contractorTeam.deleteMany({ where: { contractorId: id } });
            }
            await tx.teamMember.deleteMany({ where: { contractorId: id } });
            const result = await tx.contractor.delete({ where: { id } });
            emitSystemEvent('CONTRACTOR_UPDATE');
            return {
                softDeleted: false,
                message: `Contractor '${contractor.name}' deleted successfully.`,
                result
            };
        });
    }

    /**
     * Get teams and minimal contractor information
     */
    static async getContractorTeams(contractorId: string) {
        const [teams, contractor] = await prisma.$transaction([
            prisma.contractorTeam.findMany({
                where: { contractorId },
                include: {
                    members: true,
                    storeAssignments: {
                        include: {
                            store: { select: { id: true, name: true, type: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.contractor.findUnique({
                where: { id: contractorId },
                select: {
                    name: true,
                    contactNumber: true,
                    address: true,
                    nic: true,
                    photoUrl: true,
                    nicFrontUrl: true,
                    policeReportUrl: true,
                    gramaCertUrl: true
                }
            })
        ]);

        return { teams, contractor };
    }

    /**
     * Save contractor teams, handling upserts, store assignments, and members
     */
    static async saveContractorTeams(contractorId: string, teams: TeamInput[]) {
        const existingTeams = await prisma.contractorTeam.findMany({
            where: { contractorId },
            select: { id: true }
        });
        
        const contractor = await prisma.contractor.findUnique({
            where: { id: contractorId },
            select: { opmcId: true }
        });

        const existingIds = existingTeams.map(t => t.id);
        const incomingIds = teams.filter((t: TeamInput) => t.id && !t.id.startsWith('temp')).map((t: TeamInput) => t.id as string);
        const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));

        await prisma.$transaction(async (tx) => {
            // 1. Delete removed teams (Clean child relations and service orders first to prevent Foreign Key errors)
            if (idsToDelete.length > 0) {
                await tx.teamMember.deleteMany({
                    where: { teamId: { in: idsToDelete } }
                });
                await tx.teamStoreAssignment.deleteMany({
                    where: { teamId: { in: idsToDelete } }
                });
                await tx.serviceOrder.updateMany({
                    where: { teamId: { in: idsToDelete } },
                    data: { teamId: null }
                });
                await tx.contractorTeam.deleteMany({
                    where: { id: { in: idsToDelete } }
                });
            }

            // 2. Upsert teams
            for (const team of teams) {
                const teamData = {
                    name: team.name,
                    status: team.status,
                    contractorId: contractorId,
                    sltCode: team.sltCode || null,
                    opmcId: (team.opmcId && team.opmcId !== 'inherit') ? team.opmcId : (contractor?.opmcId || null)
                };

                let teamId = team.id;

                if (!team.id || team.id.startsWith('temp')) {
                    const newTeam = await tx.contractorTeam.create({
                        data: teamData
                    });
                    teamId = newTeam.id;
                } else {
                    await tx.contractorTeam.update({
                        where: { id: team.id },
                        data: teamData
                    });
                }

                // 3. Handle Store Assignments
                await tx.teamStoreAssignment.deleteMany({ where: { teamId } });

                if (team.storeAssignments && team.storeAssignments.length > 0) {
                    await tx.teamStoreAssignment.createMany({
                        data: team.storeAssignments.map((sa: { storeId: string; isPrimary?: boolean }) => ({
                            teamId: teamId as string,
                            storeId: sa.storeId,
                            isPrimary: sa.isPrimary || false
                        }))
                    });
                }

                // 4. Handle Members
                const currentMembers = await tx.teamMember.findMany({
                    where: { teamId },
                    select: { id: true }
                });
                const curMemIds = currentMembers.map(m => m.id);
                const incMemIds = (team.members || [])
                    .filter((m: TeamMemberInput) => m.id && !m.id.startsWith('mem'))
                    .map((m: TeamMemberInput) => m.id as string);

                const memsToDelete = curMemIds.filter(id => !incMemIds.includes(id));
                if (memsToDelete.length > 0) {
                    await tx.teamMember.deleteMany({ where: { id: { in: memsToDelete } } });
                }

                for (const member of (team.members || [])) {
                    const memData = {
                        name: member.name,
                        idCopyNumber: member.idCopyNumber,
                        nic: member.nic || member.idCopyNumber,
                        contactNumber: member.contactNumber,
                        address: member.address,
                        photoUrl: member.photoUrl,
                        nicUrl: member.nicUrl,
                        policeReportUrl: member.policeReportUrl,
                        gramaCertUrl: member.gramaCertUrl,
                        contractorId: contractorId,
                        teamId: teamId,
                        shoeSize: member.shoeSize,
                        tshirtSize: member.tshirtSize,
                        passportPhotoUrl: member.passportPhotoUrl
                    };

                    if (!member.id || member.id.startsWith('mem')) {
                        await tx.teamMember.create({ data: memData });
                    } else {
                        await tx.teamMember.update({
                            where: { id: member.id },
                            data: memData
                        });
                    }
                }
            }
        });
    }

    /**
     * Delete a single contractor team safely
     */
    static async deleteTeam(teamId: string) {
        if (!teamId) throw AppError.badRequest('TEAM_ID_REQUIRED');

        return await prisma.$transaction(async (tx) => {
            await tx.teamMember.deleteMany({ where: { teamId } });
            await tx.teamStoreAssignment.deleteMany({ where: { teamId } });
            await tx.serviceOrder.updateMany({ where: { teamId }, data: { teamId: null } });
            const result = await tx.contractorTeam.delete({ where: { id: teamId } });
            emitSystemEvent('CONTRACTOR_UPDATE');
            return result;
        });
    }

    /**
     * Assign a store to a contractor team or update its primary status
     */
    static async assignTeamStore(teamId: string, storeId: string, isPrimary?: boolean) {
        if (isPrimary) {
            await prisma.teamStoreAssignment.updateMany({
                where: { teamId },
                data: { isPrimary: false }
            });
        }

        const existing = await prisma.teamStoreAssignment.findFirst({
            where: { teamId, storeId }
        });

        if (existing) {
            return await prisma.teamStoreAssignment.update({
                where: { id: existing.id },
                data: { isPrimary }
            });
        } else {
            return await prisma.teamStoreAssignment.create({
                data: {
                    teamId,
                    storeId,
                    isPrimary: isPrimary || false
                }
            });
        }
    }

    /**
     * Remove a store assignment from a contractor team
     */
    static async removeTeamStore(teamId: string, storeId: string) {
        return await prisma.teamStoreAssignment.deleteMany({
            where: { teamId, storeId }
        });
    }

    /**
     * Resolve Contractor and Team IDs from I-Shamp Mobile Team Name (sltCode) during Portal Sync / SOD Import
     */
    static async resolveTeamAndContractorByIShampTeamName(
        iShampTeamName: string,
        opmcId?: string,
        tx?: TransactionClient
    ): Promise<{ contractorId: string | null; teamId: string | null }> {
        if (!iShampTeamName || !iShampTeamName.trim()) {
            return { contractorId: null, teamId: null };
        }

        const cleanTeamName = iShampTeamName.trim();
        const client = tx || prisma;

        // 1. Try finding ContractorTeam by sltCode or name
        const teamMatch = await client.contractorTeam.findFirst({
            where: {
                OR: [
                    { sltCode: { equals: cleanTeamName, mode: 'insensitive' } },
                    { name: { equals: cleanTeamName, mode: 'insensitive' } }
                ]
            },
            select: { id: true, contractorId: true }
        });

        if (teamMatch) {
            return { contractorId: teamMatch.contractorId, teamId: teamMatch.id };
        }

        // 2. Fallback to resolving contractor by name if opmcId is present
        if (opmcId) {
            const contractorId = await this.resolveOrCreateContractorForOpmc(cleanTeamName, opmcId, client);
            return { contractorId, teamId: null };
        }

        return { contractorId: null, teamId: null };
    }

    /**
     * Resolve or Auto-Register Contractor for an RTOM/OPMC during Portal Sync / SOD Import
     */
    static async resolveOrCreateContractorForOpmc(contractorName: string, opmcId: string, tx?: TransactionClient): Promise<string | null> {
        if (!contractorName || !contractorName.trim() || !opmcId) return null;
        const cleanName = contractorName.trim();
        const client = tx || prisma;

        // 1. Check if contractor exists for this OPMC
        const existingForOpmc = await client.contractor.findFirst({
            where: {
                opmcId,
                name: { equals: cleanName, mode: 'insensitive' }
            },
            select: { id: true }
        });
        if (existingForOpmc) return existingForOpmc.id;

        // 2. Check if contractor exists globally
        const globalMatch = await client.contractor.findFirst({
            where: {
                name: { equals: cleanName, mode: 'insensitive' }
            },
            select: { id: true, opmcId: true }
        });

        if (globalMatch) {
            if (!globalMatch.opmcId) {
                await client.contractor.update({
                    where: { id: globalMatch.id },
                    data: { opmcId }
                });
            }
            return globalMatch.id;
        }

        // 3. Auto-create contractor registered for this RTOM/OPMC
        try {
            const regNo = `AUTO-${opmcId.substring(0, 4)}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            const newContractor = await client.contractor.create({
                data: {
                    name: cleanName,
                    registrationNumber: regNo,
                    status: 'ACTIVE',
                    type: 'SOD',
                    address: `Auto-registered via Portal Data Sync`,
                    opmcId: opmcId
                },
                select: { id: true }
            });
            console.log(`[PORTAL_AUTO_CONTRACTOR] Registered '${cleanName}' for OPMC '${opmcId}'`);
            emitSystemEvent('CONTRACTOR_UPDATE');
            return newContractor.id;
        } catch (err) {
            console.error(`[PORTAL_AUTO_CONTRACTOR_ERR] Failed to auto-create contractor '${cleanName}':`, err);
            return null;
        }
    }
}
