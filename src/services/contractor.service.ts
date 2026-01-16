/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
// TODO: This file requires comprehensive refactoring to remove 'any' types and improve type safety
import { prisma } from '@/lib/prisma';
import { Prisma, ContractorStatus } from '@prisma/client';
import { NotificationService } from './notification.service';
import { emitSystemEvent } from '@/lib/events';

export interface TeamMemberInput {
    name: string;
    nic?: string;
    idCopyNumber?: string;
    contractorIdCopyNumber?: string;
    designation?: string;
    contactNumber?: string;
    address?: string;
    photoUrl?: string;
    passportPhotoUrl?: string;
    nicUrl?: string;
    policeReportUrl?: string;
    gramaCertUrl?: string;
    shoeSize?: string;
    tshirtSize?: string;
}

export interface TeamInput {
    id?: string;
    name: string;
    opmcId?: string | null;
    storeIds?: string[];
    primaryStoreId?: string;
    sltCode?: string;
    members: TeamMemberInput[];
}

export interface ContractorUpdateData {
    id?: string;
    name?: string;
    address?: string;
    email?: string;
    registrationNumber?: string;
    brNumber?: string;
    status?: ContractorStatus;
    documentStatus?: string;
    registrationFeePaid?: boolean;
    agreementSigned?: boolean;
    agreementDate?: string | Date | null;
    agreementDuration?: string | number;
    contactNumber?: string;
    nic?: string;
    brCertUrl?: string;
    bankAccountNumber?: string;
    bankBranch?: string;
    bankName?: string;
    bankPassbookUrl?: string;
    photoUrl?: string;
    nicFrontUrl?: string;
    nicBackUrl?: string;
    policeReportUrl?: string;
    gramaCertUrl?: string;
    opmcId?: string;
    siteOfficeStaffId?: string;
    registrationToken?: string;
    registrationTokenExpiry?: string | Date;
    type?: string;
    teams?: TeamInput[];
    createdAt?: Date | string;
    updatedAt?: Date | string;
    armApprovedAt?: Date | string | null;
    armApprovedById?: string | null;
    ospApprovedAt?: Date | string | null;
    ospApprovedById?: string | null;
    rejectionReason?: string | null;
    rejectionById?: string | null;
    rejectedAt?: Date | string | null;
}

export class ContractorService {

    /**
     * Get all contractors (Lightweight for List View)
     */
    static async getAllContractors(opmcIds?: string[], page: number = 1, limit: number = 50) {
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
                    },
                    teamMembers: true
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
            } as any
        });
    }

    /**
     * Generate a unique registration link for a contractor
     */
    static async generateRegistrationLink(data: { name: string, contactNumber: string, email?: string, type?: string, siteOfficeStaffId: string, origin: string }) {
        console.log("[GENERATE-LINK] Received data:", JSON.stringify(data, null, 2));

        const { name, contactNumber, email, siteOfficeStaffId, origin } = data;
        let { type } = data;

        // Default to SOD if type not specified
        if (!type) {
            console.log("[GENERATE-LINK] Type not specified, defaulting to SOD");
            type = 'SOD';
        }

        // Contractors don't get direct OPMC assignment - that happens at team level
        const opmcId = null;

        try {
            // Check for duplicates
            console.log("[GENERATE-LINK] Checking for existing contractor with contactNumber:", contactNumber);
            const existing = await prisma.contractor.findFirst({
                where: { contactNumber, status: { in: ['PENDING', 'REJECTED'] as any } }
            });

            // Generate a shorter, more user-friendly token
            const token = Math.random().toString(36).substring(2, 12).toUpperCase();
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 7);

            if (existing) {
                console.log("[GENERATE-LINK] Found existing contractor, updating with new token");
                // Update existing record with fresh token
                const updated = await prisma.contractor.update({
                    where: { id: existing.id },
                    data: {
                        name,
                        type: type as any,
                        registrationToken: token,
                        registrationTokenExpiry: expiry,
                        registrationStartedAt: null, // Reset activation clock
                        siteOfficeStaffId,
                        opmcId: null // Teams handle OPMC assignment
                    } as any
                });
                console.log("[GENERATE-LINK] Successfully updated existing contractor");
                return {
                    contractor: updated,
                    registrationLink: `${origin}/contractor-registration/${token}`,
                    isUpdate: true
                };
            }

            // Validate other unique fields for brand new contractors
            console.log("[GENERATE-LINK] Creating new contractor");
            await this.validateUnique({ contactNumber });

            const contractor = await prisma.contractor.create({
                data: {
                    name,
                    contactNumber,
                    email,
                    type: type as any,
                    status: 'PENDING',
                    registrationToken: token,
                    registrationTokenExpiry: expiry,
                    siteOfficeStaffId,
                    opmcId: null // Teams handle OPMC assignment
                } as any
            });

            console.log("[GENERATE-LINK] Successfully created new contractor");
            return {
                contractor,
                registrationLink: `${origin}/contractor-registration/${token}`
            };
        } catch (error) {
            console.error("[GENERATE-LINK] Error:", error);
            throw error;
        }
    }

    /**
     * Resend or regenerate a registration link for an existing contractor
     */
    static async resendRegistrationLink(id: string, origin: string) {
        const contractor = await prisma.contractor.findUnique({
            where: { id }
        }) as any;

        if (!contractor) throw new Error('CONTRACTOR_NOT_FOUND');

        // If already in approval flow, move back to REJECTED so they can edit
        if (!['PENDING', 'REJECTED'].includes(contractor.status)) {
            await prisma.contractor.update({
                where: { id },
                data: { status: 'REJECTED' as any }
            });
        }

        // Always generate a fresh token and 7-day expiry for a re-share request
        // Generate a shorter, user-friendly token
        const token = Math.random().toString(36).substring(2, 12).toUpperCase();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 7);

        const updated = await prisma.contractor.update({
            where: { id },
            data: {
                registrationToken: token,
                registrationTokenExpiry: expiry,
                registrationStartedAt: null, // Reset the 3-day activation clock
            } as any
        });

        return {
            contractor: updated,
            registrationLink: `${origin}/contractor-registration/${token}`
        };
    }

    /**
     * Get contractor by registration token (with expiry check)
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

        // Expiry check
        if (contractor.registrationTokenExpiry && new Date(contractor.registrationTokenExpiry) < new Date()) {
            throw new Error('TOKEN_EXPIRED');
        }

        // Status Check - Only PENDING or REJECTED can access the form
        if (!['PENDING', 'REJECTED'].includes(contractor.status)) {
            throw new Error('ALREADY_SUBMITTED');
        }

        // Handle First Access - Start the 3-day clock
        if (!contractor.registrationStartedAt && contractor.status === 'PENDING') {
            const now = new Date();
            // Generate a shorter, user-friendly token
            const newToken = Math.random().toString(36).substring(2, 12).toUpperCase();
            const expiry = new Date();
            expiry.setDate(now.getDate() + 3); // Link active for 3 days from first access

            return await prisma.contractor.update({
                where: { id: contractor.id },
                data: {
                    registrationStartedAt: now,
                    registrationTokenExpiry: expiry
                } as any,
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

        const { emitSystemEvent } = require('@/lib/events');
        emitSystemEvent('CONTRACTOR_UPDATE');
        return contractor;
    }

    /**
     * Save partial registration data as draft
     */
    static async saveRegistrationDraft(token: string, draftData: ContractorUpdateData) {
        console.log("[DRAFT-SAVE] Incoming data:", JSON.stringify(draftData, null, 2));
        const contractor = await this.getContractorByToken(token);

        // Merge with existing draft to prevent data loss from client-side race conditions
        const currentDraft = (contractor.registrationDraft as any) || {};
        console.log("[DRAFT-SAVE] Current DB draft:", JSON.stringify(currentDraft, null, 2));
        const mergedDraft = { ...currentDraft };

        // Smart merge: Only update if the new value is "meaningful" (not empty/null/stale)
        // This protects against a full form-state upload with empty fields overwriting specific uploads
        for (const key in draftData) {
            const newVal = (draftData as any)[key];

            // If it's an object/array (like teams), we might want to be more specific, 
            // but for now, we only update if the value is not empty.
            if (newVal !== "" && newVal !== null && newVal !== undefined) {
                // Special case for teams: only update if the incoming teams array has content or members
                if (key === 'teams' && Array.isArray(newVal)) {
                    if (newVal.length > 0) {
                        console.log(`[DRAFT-SAVE] Updating teams (${newVal.length} items)`);
                        mergedDraft[key] = newVal;
                    }
                } else {
                    console.log(`[DRAFT-SAVE] Updating ${key}`);
                    mergedDraft[key] = newVal;
                }
            } else {
                console.log(`[DRAFT-SAVE] Skipping empty ${key}`);
            }
        }

        console.log("[DRAFT-SAVE] Final merged:", JSON.stringify(mergedDraft, null, 2));

        return await prisma.contractor.update({
            where: { id: contractor.id },
            data: { registrationDraft: mergedDraft as Prisma.InputJsonValue }
        });
    }

    /**
     * Submit public registration data
     */
    static async submitPublicRegistration(token: string, data: ContractorUpdateData) {
        console.log("[SUBMIT] Starting registration submission for token:", token);

        // 1. Fetch and validate contractor OUTSIDE transaction to prevent conflicts
        const contractor = await this.getContractorByToken(token);
        console.log("[SUBMIT] Contractor found:", contractor.id, contractor.name);

        const { teams, id: _id, createdAt: _c, updatedAt: _u, ...restData } = data;

        // 2. Validate uniqueness OUTSIDE transaction
        console.log("[SUBMIT] Validating unique fields...");
        await this.validateUnique({
            nic: restData.nic,
            contactNumber: restData.contactNumber
        }, contractor.id);

        // 3. Use transaction ONLY for database mutations
        console.log("[SUBMIT] Starting database transaction...");
        const result = await prisma.$transaction(async (tx) => {
            console.log("[SUBMIT-TX] Updating contractor details...");
            // Update Contractor Basic Details
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
                    status: 'ARM_PENDING' as any,
                    registrationDraft: null,
                    registrationStartedAt: null,
                    registrationToken: null,
                    registrationTokenExpiry: null,
                } as any
            });

            console.log("[SUBMIT-TX] Cleaning up existing teams/members...");
            // Clean up any existing teams/members (in case of re-submission)
            await tx.teamMember.deleteMany({ where: { contractorId: contractor.id } });
            await tx.contractorTeam.deleteMany({ where: { contractorId: contractor.id } });

            // Create Teams and Members
            if (teams && teams.length > 0) {
                console.log(`[SUBMIT-TX] Creating ${teams.length} teams...`);
                for (const team of teams) {
                    await tx.contractorTeam.create({
                        data: {
                            name: team.name,
                            contractorId: contractor.id,
                            opmcId: updated.opmcId, // Inherit from contractor
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
                        } as any
                    });
                }
            }

            console.log("[SUBMIT-TX] Transaction completed successfully");
            emitSystemEvent('CONTRACTOR_UPDATE');
            return updated;
        }, {
            maxWait: 10000, // Maximum time to wait for a transaction slot (10s)
            timeout: 30000, // Maximum time the transaction can run (30s)
        });

        // 4. Notify Relevant Staff (Outside transaction for reliability)
        console.log("[SUBMIT] Sending notifications...");
        try {
            const message = `Contractor "${result.name}" has submitted their registration form and is waiting for ARM review.`;

            // Notify the person who generated the link
            if (result.siteOfficeStaffId) {
                console.log("[SUBMIT] Notifying link generator (siteOfficeStaffId):", result.siteOfficeStaffId);
                await NotificationService.send({
                    userId: result.siteOfficeStaffId,
                    title: "New Contractor Submission",
                    message,
                    type: 'CONTRACTOR',
                    priority: 'HIGH',
                    link: `/admin/contractors`,
                    metadata: { contractorId: result.id, name: result.name }
                });
            }

            // Also notify ARMs and Admins
            console.log("[SUBMIT] Broadcasting notifications to management roles...");
            await NotificationService.notifyByRole({
                roles: ['SUPER_ADMIN', 'ADMIN', 'AREA_MANAGER', 'OSP_MANAGER', 'MANAGER', 'OFFICE_ADMIN', 'ENGINEER'],
                title: "Contractor Pending Review",
                message,
                type: 'CONTRACTOR',
                priority: 'HIGH', // Increased to HIGH
                link: `/admin/contractors/approvals`, // Direct to approvals page
                opmcId: result.opmcId || undefined,
                metadata: { contractorId: result.id, name: result.name, stage: 'ARM_REVIEW' }
            });
            console.log("[SUBMIT] All notifications sent successfully.");
        } catch (nErr) {
            console.error("[SUBMIT] Failed to send submission notifications:", nErr);
        }

        console.log("[SUBMIT] Registration submission completed successfully");
        const { emitSystemEvent } = require('@/lib/events');
        emitSystemEvent('CONTRACTOR_UPDATE');
        return result;
    }

    /**
     * Create a new contractor with optional initial teams
     */
    static async createContractor(data: ContractorUpdateData) {
        // Validate required fields
        if (!data.name || !data.registrationNumber) {
            throw new Error('NAME_AND_REGISTRATION_REQUIRED');
        }

        // Check for duplicates
        await this.validateUnique({
            nic: data.nic,
            contactNumber: data.contactNumber,
            registrationNumber: data.registrationNumber
        });

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
                            create: team.members.map((m) => ({
                                name: m.name,
                                nic: m.nic || m.idCopyNumber || '', // Backwards compatibility
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
                    } as any
                });
            }
        }

        const { emitSystemEvent } = require('@/lib/events');
        emitSystemEvent('CONTRACTOR_UPDATE');
        return contractor;
    }

    /**
     * Update an existing contractor (including full Team Sync)
     */
    static async updateContractor(id: string, data: ContractorUpdateData) {
        if (!id) throw new Error('ID_REQUIRED');

        // Check for duplicates excluding current contractor
        await this.validateUnique({
            nic: data.nic,
            contactNumber: data.contactNumber,
            registrationNumber: data.registrationNumber
        }, id);

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
                ospApprovedById: contractorData.ospApprovedById,
                rejectionReason: contractorData.rejectionReason,
                rejectionById: contractorData.rejectionById,
                rejectedAt: contractorData.rejectedAt
            } as any
        });

        // 1.1 Notify on Status Change
        if (contractorData.status) {
            try {
                const reporterId = updated.siteOfficeStaffId;
                if (reporterId) {
                    if (contractorData.status === 'OSP_PENDING') {
                        // ARM Approved -> Notify OSP Managers and Site Office Staff
                        await NotificationService.send({
                            userId: reporterId,
                            title: "Contractor ARM Approved",
                            message: `Contractor "${updated.name}" has been approved by the Area Manager and is now waiting for OSP Manager authorization.`,
                            type: 'CONTRACTOR',
                            priority: 'MEDIUM'
                        });

                        // Also notify OSP Managers in the same RTOM
                        await NotificationService.notifyByRole({
                            roles: ['OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN'],
                            title: "New Contractor Pending Authorization",
                            message: `Contractor "${updated.name}" is waiting for your final authorization.`,
                            type: 'CONTRACTOR',
                            priority: 'HIGH',
                            opmcId: updated.opmcId || undefined,
                            link: '/admin/contractors/approvals'
                        });
                    } else if (contractorData.status === 'ACTIVE') {
                        // Fully Approved
                        await NotificationService.send({
                            userId: reporterId,
                            title: "Contractor Fully Activated",
                            message: `Contractor "${updated.name}" is now ACTIVE. Teams can now be assigned to SOD jobs.`,
                            type: 'CONTRACTOR',
                            priority: 'HIGH'
                        });
                    } else if (contractorData.status === 'REJECTED') {
                        // Rejected
                        await NotificationService.send({
                            userId: reporterId,
                            title: "Contractor Registration Rejected",
                            message: `Registration for "${updated.name}" was rejected. Reason: ${contractorData.rejectionReason || 'No reason provided'}. Please ask the contractor to fix and re-submit.`,
                            type: 'CONTRACTOR',
                            priority: 'CRITICAL'
                        });
                    }
                }
            } catch (nErr) {
                console.error("Failed to send status update notification:", nErr);
            }
        }

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
                            sltCode: team.sltCode,
                            storeAssignments: {
                                deleteMany: {},
                                create: team.storeIds?.map((storeId: string) => ({
                                    storeId,
                                    isPrimary: storeId === team.primaryStoreId
                                }))
                            }
                        } as any
                    });

                    // Sync Members (Replace for simplicity)
                    await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
                    if (team.members && team.members.length > 0) {
                        await prisma.teamMember.createMany({
                            data: team.members.map((m: any) => ({
                                name: m.name,
                                nic: m.nic || m.idCopyNumber || '',
                                idCopyNumber: m.nic || m.idCopyNumber || '',
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
                            opmcId: team.opmcId || updated.opmcId || null,
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
                                    contractorId: id
                                }))
                            }
                        } as any
                    });
                }
            }
        }

        const { emitSystemEvent } = require('@/lib/events');
        emitSystemEvent('CONTRACTOR_UPDATE');
        return updated;
    }

    /**
     * Delete a contractor
     */
    static async deleteContractor(id: string) {
        if (!id) throw new Error('ID_REQUIRED');

        // 1. Check if they have critical related data (Inventory, Projects etc)
        const counts = await prisma.contractor.findUnique({
            where: { id },
            select: {
                _count: {
                    select: {
                        serviceOrders: true,
                        projects: true,
                        stock: true
                    }
                }
            }
        });

        if (counts && (counts._count.serviceOrders > 0 || counts._count.projects > 0 || counts._count.stock > 0)) {
            throw new Error('HAS_RELATED_DATA');
        }

        // 2. Cascade delete minor things (Teams, Members are handled via schema cascade if defined, 
        // but we'll do it explicitly or use deleteMany to be safe)
        // Note: Schema should ideally handle cascades.

        console.log(`[DELETE-CONTRACTOR] Attempting to delete ID: ${id}`);
        const result = await prisma.contractor.deleteMany({ where: { id } });
        console.log(`[DELETE-CONTRACTOR] Delete result:`, result);

        if (result.count === 0) {
            throw new Error(`NOT_FOUND_FOR_DELETE:${id}`);
        }

        const { emitSystemEvent } = require('@/lib/events');
        emitSystemEvent('CONTRACTOR_UPDATE');
        return result;
    }

    /**
     * Helper to validate uniqueness of sensitive fields
     */
    private static async validateUnique(data: { nic?: string, contactNumber?: string, registrationNumber?: string }, excludeId?: string) {
        const orFilters = [];
        if (data.nic) orFilters.push({ nic: data.nic });
        if (data.contactNumber) orFilters.push({ contactNumber: data.contactNumber });
        if (data.registrationNumber) orFilters.push({ registrationNumber: data.registrationNumber });

        if (orFilters.length === 0) return;

        const existing = await prisma.contractor.findFirst({
            where: {
                OR: orFilters,
                NOT: excludeId ? { id: excludeId } : undefined
            } as any
        }) as any;

        if (existing) {
            if (data.nic && existing.nic === data.nic) throw new Error('NIC_ALREADY_REGISTERED');
            if (data.contactNumber && existing.contactNumber === data.contactNumber) throw new Error('CONTACT_NUMBER_ALREADY_EXISTS');
            if (data.registrationNumber && existing.registrationNumber === data.registrationNumber) throw new Error('REGISTRATION_NUMBER_ALREADY_EXISTS');
        }
    }
}
