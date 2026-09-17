import { prisma } from '@/lib/prisma';
import { signJWT } from '@/lib/auth';
import crypto from 'crypto';

export interface SyncAssetPayload {
    computerName: string;
    serialNumber: string;
    osVersion: string;
    employeeUsername: string;
    employeeNumber: string;
    ipAddress: string;
    macAddress: string;
    brand?: string;
    model?: string;
}

export interface RegisterAssetPayload {
    computerName: string;
    serialNumber: string;
    osVersion: string;
    employeeUsername: string;
    employeeNumber: string;
    department?: string;
    location?: string;
    brand?: string;
    model?: string;
}

export function generateAssetId(serialNumber: string): string {
    const hash = crypto.createHash('sha256').update(serialNumber).digest('hex');
    return `AGENT-${hash.substring(0, 8).toUpperCase()}`;
}

export class AgentSyncService {
    /**
     * Authenticates the agent using the static API key and returns a short-lived JWT.
     */
    static async authenticateAgent(apiKey: string): Promise<{ success: boolean; token?: string; expiresIn?: number } | null> {
        // Fail-closed: without a configured key NO agent can authenticate
        const validApiKey = process.env.AGENT_API_KEY;
        if (!validApiKey || apiKey !== validApiKey) {
            return null;
        }

        const token = await signJWT({ role: 'agent' }, '24h');
        
        return {
            success: true,
            token,
            expiresIn: 86400
        };
    }

    /**
     * Periodically called by the desktop agent to upsert asset status and auto-register if missing.
     */
    static async syncAsset(data: SyncAssetPayload, clientIp: string) {
        const {
            computerName,
            serialNumber,
            osVersion,
            employeeUsername,
            employeeNumber,
            ipAddress,
            macAddress,
            brand,
            model
        } = data;

        const cleanSerial = serialNumber.trim();
        const cleanEmpNo = (employeeNumber || '').trim();
        const unpaddedEmpNo = cleanEmpNo.replace(/^0+/, '');
        const searchEmpNos = Array.from(new Set([cleanEmpNo, unpaddedEmpNo].filter(Boolean)));

        // Look up staff & user for auto-assignment linking
        const [foundStaff, foundUser] = await Promise.all([
            searchEmpNos.length > 0
                ? prisma.staff.findFirst({
                    where: { employeeId: { in: searchEmpNos, mode: 'insensitive' as const } },
                    select: { id: true, name: true, employeeId: true }
                })
                : null,
            searchEmpNos.length > 0 || employeeUsername
                ? prisma.user.findFirst({
                    where: {
                        OR: [
                            ...(searchEmpNos.length > 0 ? [{ employeeId: { in: searchEmpNos, mode: 'insensitive' as const } }] : []),
                            ...(employeeUsername ? [{ username: { equals: employeeUsername.trim(), mode: 'insensitive' as const } }] : [])
                        ]
                    },
                    select: { id: true, name: true, employeeId: true, status: true }
                })
                : null
        ]);

        const invalidModels = ["unknown", "pc", "system product name", "system product", "to be filled by o.e.m.", "default string"];

        // 1. Look up the ITAsset by serialNumber (exact or case-insensitive fallback)
        let asset = await prisma.iTAsset.findFirst({
            where: {
                serialNumber: {
                    equals: cleanSerial,
                    mode: 'insensitive' as const
                }
            },
            select: {
                id: true,
                serialNumber: true,
                assignedStaffId: true,
                assignedUserId: true,
                brand: true,
                model: true
            }
        });

        const newBrandValid = brand && brand.trim() !== "" && brand.toLowerCase() !== "unknown";
        const newModelValid = model && model.trim() !== "" && !invalidModels.includes(model.toLowerCase().trim());

        // 2. Auto-Register if asset does not exist in DB yet
        if (!asset) {
            const created = await prisma.iTAsset.create({
                data: {
                    assetNumber: `SLT-AGENT-IT-${Math.floor(100000 + Math.random() * 900000)}`,
                    serialNumber: cleanSerial,
                    deviceType: 'LAPTOP',
                    brand: newBrandValid ? brand.trim() : 'Unknown',
                    model: newModelValid ? model.trim() : 'Unknown',
                    computerName,
                    osVersion,
                    ipAddress,
                    macAddress,
                    employeeUsername,
                    lastSeenEmployeeUsername: employeeUsername,
                    lastSeenEmployeeNumber: employeeNumber,
                    assignedStaffId: foundStaff?.id || null,
                    assignedUserId: foundUser?.id || null,
                    pendingAssignmentReview: !foundStaff,
                    lastSyncedAt: new Date()
                }
            });

            await prisma.assetSyncLog.create({
                data: {
                    assetId: created.id,
                    reportedEmployeeNumber: employeeNumber,
                    reportedEmployeeUsername: employeeUsername,
                    ipAddress: clientIp,
                    syncedAt: new Date()
                }
            });

            return {
                success: true,
                message: 'Asset automatically registered and synced',
                assetId: generateAssetId(cleanSerial),
                employeeStatus: foundUser?.status || 'active',
                assignedEmployeeName: foundStaff?.name || foundUser?.name || null,
                assignedEmployeeNumber: foundStaff?.employeeId || foundUser?.employeeId || employeeNumber
            };
        }

        // Keep existing brand/model if already set to a valid non-default value in database.
        const currentBrandValid = asset.brand && asset.brand.trim() !== "" && asset.brand.toLowerCase() !== "unknown";
        const finalBrand = currentBrandValid ? asset.brand : (newBrandValid ? brand : undefined);

        const currentModelValid = asset.model && asset.model.trim() !== "" && !invalidModels.includes(asset.model.toLowerCase().trim());
        const finalModel = currentModelValid ? asset.model : (newModelValid ? model : undefined);

        // Auto-heal assigned staff / user if not linked yet
        const updatedStaffId = asset.assignedStaffId || (foundStaff?.id || null);
        const updatedUserId = asset.assignedUserId || (foundUser?.id || null);

        // 3. Update existing asset details
        await prisma.iTAsset.update({
            where: { id: asset.id },
            data: {
                computerName,
                osVersion,
                ipAddress,
                macAddress,
                employeeUsername,
                brand: finalBrand,
                model: finalModel,
                assignedStaffId: updatedStaffId,
                assignedUserId: updatedUserId,
                lastSeenEmployeeUsername: employeeUsername,
                lastSeenEmployeeNumber: employeeNumber,
                lastSyncedAt: new Date()
            }
        });

        // 4. Log sync event
        await prisma.assetSyncLog.create({
            data: {
                assetId: asset.id,
                reportedEmployeeNumber: employeeNumber,
                reportedEmployeeUsername: employeeUsername,
                ipAddress: clientIp,
                syncedAt: new Date()
            }
        });

        let employeeStatus = foundUser?.status || 'active';
        let assignedEmployeeName: string | null = foundStaff?.name || foundUser?.name || null;
        let assignedEmployeeNumber: string | null = foundStaff?.employeeId || foundUser?.employeeId || employeeNumber;

        if (updatedUserId && !assignedEmployeeName) {
            const employee = await prisma.user.findUnique({
                where: { id: updatedUserId },
                select: { name: true, employeeId: true, status: true }
            });
            if (employee) {
                employeeStatus = employee.status || 'active';
                assignedEmployeeName = employee.name;
                assignedEmployeeNumber = employee.employeeId;
            }
        }

        return {
            success: true,
            message: 'Asset record updated',
            assetId: generateAssetId(cleanSerial),
            employeeStatus,
            assignedEmployeeName,
            assignedEmployeeNumber
        };
    }

    /**
     * Registers a new asset and links matching staff/user.
     */
    static async registerAsset(data: RegisterAssetPayload) {
        const {
            computerName,
            serialNumber,
            osVersion,
            employeeUsername,
            employeeNumber,
            department,
            location,
            brand,
            model
        } = data;

        const cleanSerial = serialNumber.trim();
        const cleanEmpNo = (employeeNumber || '').trim();
        const unpaddedEmpNo = cleanEmpNo.replace(/^0+/, '');
        const searchEmpNos = Array.from(new Set([cleanEmpNo, unpaddedEmpNo].filter(Boolean)));

        const [foundStaff, foundUser] = await Promise.all([
            searchEmpNos.length > 0
                ? prisma.staff.findFirst({
                    where: { employeeId: { in: searchEmpNos, mode: 'insensitive' as const } },
                    select: { id: true }
                })
                : null,
            searchEmpNos.length > 0 || employeeUsername
                ? prisma.user.findFirst({
                    where: {
                        OR: [
                            ...(searchEmpNos.length > 0 ? [{ employeeId: { in: searchEmpNos, mode: 'insensitive' as const } }] : []),
                            ...(employeeUsername ? [{ username: { equals: employeeUsername.trim(), mode: 'insensitive' as const } }] : [])
                        ]
                    },
                    select: { id: true }
                })
                : null
        ]);

        // Check if ITAsset already exists
        const existingAsset = await prisma.iTAsset.findFirst({
            where: { serialNumber: { equals: cleanSerial, mode: 'insensitive' as const } },
            select: { id: true, serialNumber: true }
        });

        if (existingAsset) {
            return {
                success: true,
                assetId: generateAssetId(cleanSerial)
            };
        }

        // Create the ITAsset
        await prisma.iTAsset.create({
            data: {
                assetNumber: `SLT-AGENT-IT-${Math.floor(100000 + Math.random() * 900000)}`,
                serialNumber: cleanSerial,
                deviceType: 'LAPTOP',
                brand: brand || 'Unknown',
                model: model || 'Unknown',
                computerName,
                osVersion,
                pendingAssignmentReview: !foundStaff,
                employeeUsername,
                lastSeenEmployeeUsername: employeeUsername,
                lastSeenEmployeeNumber: employeeNumber,
                assignedStaffId: foundStaff?.id || null,
                assignedUserId: foundUser?.id || null,
                department,
                location
            }
        });

        return {
            success: true,
            assetId: generateAssetId(cleanSerial)
        };
    }
}
