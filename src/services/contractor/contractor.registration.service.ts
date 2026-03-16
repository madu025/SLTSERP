import { prisma } from '@/lib/prisma';
import { Prisma, ContractorType, ContractorStatus } from '@prisma/client';
import { emitSystemEvent } from '@/lib/events';
import { RegistrationLinkParams, ContractorUpdateData } from './contractor-types';
import { ContractorQueryService } from './contractor.query.service';
import { NotificationPolicyService } from '../notification/notification-policy.service';

export class ContractorRegistrationService {
    /**
     * Generate a unique registration link
     */
    static async generateRegistrationLink(data: RegistrationLinkParams) {
        const { name, contactNumber, email, siteOfficeStaffId, origin } = data;
        let { type } = data;

        if (!type) type = 'SOD';

        try {
            const existing = await prisma.contractor.findFirst({
                where: { contactNumber, status: { in: ['PENDING', 'REJECTED'] } }
            });

            const token = Math.random().toString(36).substring(2, 12).toUpperCase();
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 7);

            if (existing) {
                const updated = await prisma.contractor.update({
                    where: { id: existing.id },
                    data: {
                        name,
                        type: type as ContractorType,
                        registrationToken: token,
                        registrationTokenExpiry: expiry,
                        registrationStartedAt: null,
                        siteOfficeStaffId,
                        opmcId: null
                    }
                });
                return {
                    contractor: updated,
                    registrationLink: `${origin}/contractor-registration/${token}`,
                    isUpdate: true
                };
            }

            await ContractorQueryService.validateUnique({ contactNumber });

            const contractor = await prisma.contractor.create({
                data: {
                    name,
                    contactNumber,
                    email,
                    type: type as ContractorType,
                    status: 'PENDING',
                    registrationToken: token,
                    registrationTokenExpiry: expiry,
                    siteOfficeStaffId,
                    opmcId: null
                }
            });

            return {
                contractor,
                registrationLink: `${origin}/contractor-registration/${token}`
            };
        } catch (error) {
            console.error("[REG-SERVICE] generateRegistrationLink Error:", error);
            throw error;
        }
    }

    /**
     * Resend registration link for an existing contractor
     */
    static async resendRegistrationLink(id: string, origin: string) {
        const contractor = await prisma.contractor.findUnique({
            where: { id }
        });

        if (!contractor) throw new Error('CONTRACTOR_NOT_FOUND');

        if (!['PENDING', 'REJECTED'].includes(contractor.status)) {
            await prisma.contractor.update({
                where: { id },
                data: { status: 'REJECTED' }
            });
        }

        const token = Math.random().toString(36).substring(2, 12).toUpperCase();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 7);

        const updated = await prisma.contractor.update({
            where: { id },
            data: {
                registrationToken: token,
                registrationTokenExpiry: expiry,
                registrationStartedAt: null,
            }
        });

        return {
            contractor: updated,
            registrationLink: `${origin}/contractor-registration/${token}`
        };
    }

    /**
     * Get contractor by registration token
     */
    static async getContractorByToken(token: string) {
        const contractor = await prisma.contractor.findFirst({
            where: { registrationToken: token },
            include: {
                teams: {
                    include: {
                        members: true,
                        storeAssignments: true
                    }
                }
            }
        });

        if (!contractor) throw new Error('INVALID_TOKEN');

        if (contractor.registrationTokenExpiry && new Date(contractor.registrationTokenExpiry) < new Date()) {
            throw new Error('TOKEN_EXPIRED');
        }

        if (!['PENDING', 'REJECTED'].includes(contractor.status)) {
            throw new Error('ALREADY_SUBMITTED');
        }

        if (!contractor.registrationStartedAt && contractor.status === 'PENDING') {
            const now = new Date();
            const expiry = new Date();
            expiry.setDate(now.getDate() + 3);

            return await prisma.contractor.update({
                where: { id: contractor.id },
                data: {
                    registrationStartedAt: now,
                    registrationTokenExpiry: expiry
                },
                include: {
                    teams: {
                        include: {
                            members: true,
                            storeAssignments: true
                        }
                    }
                }
            });
        }

        return contractor;
    }

    /**
     * Save registration data as draft
     */
    static async saveRegistrationDraft(token: string, draftData: ContractorUpdateData) {
        const contractor = await this.getContractorByToken(token);
        const currentDraft = (contractor.registrationDraft as Record<string, unknown>) || {};
        const mergedDraft = { ...currentDraft };

        for (const key in draftData) {
            const newVal = (draftData as Record<string, unknown>)[key];
            if (newVal !== "" && newVal !== null && newVal !== undefined) {
                if (key === 'teams' && Array.isArray(newVal)) {
                    if (newVal.length > 0) mergedDraft[key] = newVal;
                } else {
                    mergedDraft[key] = newVal;
                }
            }
        }

        return await prisma.contractor.update({
            where: { id: contractor.id },
            data: { 
                registrationDraft: mergedDraft as Prisma.InputJsonValue,
                registrationStartedAt: contractor.registrationStartedAt || new Date()
            }
        });
    }

    /**
     * Submit registration data
     */
    static async submitPublicRegistration(token: string, data: ContractorUpdateData) {
        const contractor = await this.getContractorByToken(token);
        const { teams, id: _id, createdAt: _c, updatedAt: _u, ...restData } = data;
        void _id; void _c; void _u;

        await ContractorQueryService.validateUnique({
            nic: restData.nic,
            contactNumber: restData.contactNumber
        }, contractor.id);

        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.contractor.update({
                where: { id: contractor.id },
                data: {
                    name: restData.name || contractor.name,
                    email: restData.email || contractor.email,
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
                    status: 'ARM_PENDING' as ContractorStatus,
                    registrationDraft: Prisma.JsonNull,
                    registrationStartedAt: null,
                    registrationToken: null,
                    registrationTokenExpiry: null,
                }
            });

            await tx.teamMember.deleteMany({ where: { contractorId: contractor.id } });
            await tx.contractorTeam.deleteMany({ where: { contractorId: contractor.id } });

            if (teams && teams.length > 0) {
                for (const team of teams) {
                    await tx.contractorTeam.create({
                        data: {
                            name: team.name,
                            contractorId: contractor.id,
                            opmcId: updated.opmcId,
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
                                    address: m.address || '',
                                    designation: m.designation || '',
                                    photoUrl: m.photoUrl || '',
                                    passportPhotoUrl: m.passportPhotoUrl || '',
                                    nicUrl: m.nicUrl || '',
                                    policeReportUrl: m.policeReportUrl || '',
                                    gramaCertUrl: m.gramaCertUrl || '',
                                    shoeSize: m.shoeSize || '',
                                    tshirtSize: m.tshirtSize || '',
                                    idCopyNumber: m.idCopyNumber || m.nic || '',
                                    contractorId: contractor.id
                                }))
                            }
                        }
                    });
                }
            }

            return updated;
        }, {
            maxWait: 10000,
            timeout: 30000,
        });

        try {
            await NotificationPolicyService.notifyContractorSubmission({
                id: result.id,
                name: result.name,
                siteOfficeStaffId: result.siteOfficeStaffId,
                opmcId: result.opmcId
            });
        } catch (nErr) {
            console.error("[REG-SERVICE] Notification Failed:", nErr);
        }

        emitSystemEvent('CONTRACTOR_UPDATE');
        return result;
    }
}
