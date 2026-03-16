import { prisma } from '@/lib/prisma';
import { ContractorType, ContractorStatus } from '@prisma/client';
import { emitSystemEvent } from '@/lib/events';
import { ContractorUpdateData } from './contractor-types';
import { ContractorQueryService } from './contractor.query.service';
import { NotificationPolicyService } from '../notification/notification-policy.service';

export class ContractorLifecycleService {
    /**
     * Create a new contractor (Admin Flow)
     */
    static async createContractor(data: ContractorUpdateData) {
        if (!data.name || !data.registrationNumber) {
            throw new Error('NAME_AND_REGISTRATION_REQUIRED');
        }

        await ContractorQueryService.validateUnique({
            nic: data.nic,
            contactNumber: data.contactNumber,
            registrationNumber: data.registrationNumber
        });

        const { teams = [], ...contractorData } = data;

        const contractor = await prisma.contractor.create({
            data: {
                name: contractorData.name,
                address: contractorData.address,
                registrationNumber: contractorData.registrationNumber,
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
                opmcId: contractorData.opmcId || null,
                siteOfficeStaffId: contractorData.siteOfficeStaffId,
            }
        });

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
                            create: team.members.map((m) => ({
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
                    }
                });
            }
        }

        emitSystemEvent('CONTRACTOR_UPDATE');
        return contractor;
    }

    /**
     * Update an existing contractor (Admin/Approval Flow)
     */
    static async updateContractor(id: string, data: ContractorUpdateData) {
        if (!id) throw new Error('ID_REQUIRED');

        await ContractorQueryService.validateUnique({
            nic: data.nic,
            contactNumber: data.contactNumber,
            registrationNumber: data.registrationNumber
        }, id);

        const { teams, id: _removeId, ...contractorData } = data;
        void _removeId;

        const updated = await prisma.contractor.update({
            where: { id },
            data: {
                name: contractorData.name,
                address: contractorData.address,
                registrationNumber: contractorData.registrationNumber,
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
                armApprovedAt: contractorData.armApprovedAt,
                armApprovedById: contractorData.armApprovedById,
                ospApprovedAt: contractorData.ospApprovedAt,
                ospApprovedById: contractorData.ospApprovedById,
                rejectionReason: contractorData.rejectionReason,
                rejectionById: contractorData.rejectionById,
                rejectedAt: contractorData.rejectedAt
            }
        });

        if (contractorData.status) {
            await this.handleStatusChangeNotifications(updated, contractorData);
        }

        if (teams) {
            await this.syncTeams(id, teams, updated.opmcId);
        }

        emitSystemEvent('CONTRACTOR_UPDATE');
        return updated;
    }

    /**
     * Handle notifications on status changes
     */
    private static async handleStatusChangeNotifications(contractor: { id: string; name: string; siteOfficeStaffId: string | null; opmcId: string | null }, data: ContractorUpdateData) {
        try {
            await NotificationPolicyService.notifyContractorStatusChange(
                contractor,
                data.status as string,
                data.rejectionReason
            );
        } catch (err) {
            console.error("[LIFECYCLE] Notification Failed:", err);
        }
    }

    /**
     * Sync Teams and Members
     */
    private static async syncTeams(contractorId: string, teams: any[], defaultOpmcId: string | null) {
        const existingTeams = await prisma.contractorTeam.findMany({
            where: { contractorId },
            select: { id: true }
        });
        const existingTeamIds = existingTeams.map(t => t.id);
        const incomingTeamIds = teams.filter(t => t.id).map(t => t.id);

        const teamsToDelete = existingTeamIds.filter(tid => !incomingTeamIds.includes(tid));
        if (teamsToDelete.length > 0) {
            await prisma.contractorTeam.deleteMany({ where: { id: { in: teamsToDelete } } });
        }

        for (const team of teams) {
            if (team.id && existingTeamIds.includes(team.id)) {
                await prisma.contractorTeam.update({
                    where: { id: team.id },
                    data: {
                        name: team.name,
                        opmcId: team.opmcId || defaultOpmcId,
                        sltCode: team.sltCode,
                        storeAssignments: {
                            deleteMany: {},
                            create: team.storeIds?.map((storeId: string) => ({
                                storeId,
                                isPrimary: storeId === team.primaryStoreId
                            }))
                        }
                    }
                });
                await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
                if (team.members && team.members.length > 0) {
                    await prisma.teamMember.createMany({
                        data: team.members.map((m: any) => ({
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
                        }))
                    });
                }
            } else {
                await prisma.contractorTeam.create({
                    data: {
                        name: team.name,
                        contractorId,
                        opmcId: team.opmcId || defaultOpmcId,
                        sltCode: team.sltCode,
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
                    }
                });
            }
        }
    }

    /**
     * Delete a contractor
     */
    static async deleteContractor(id: string) {
        if (!id) throw new Error('ID_REQUIRED');
        const counts = await prisma.contractor.findUnique({
            where: { id },
            select: {
                _count: {
                    select: { serviceOrders: true, projects: true, stock: true }
                }
            }
        });

        if (counts && (counts._count.serviceOrders > 0 || counts._count.projects > 0 || counts._count.stock > 0)) {
            throw new Error('HAS_RELATED_DATA');
        }

        const result = await prisma.contractor.deleteMany({ where: { id } });
        emitSystemEvent('CONTRACTOR_UPDATE');
        return result;
    }
}
