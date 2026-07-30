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
        const validApiKey = process.env.AGENT_API_KEY || 'slts-agent-secure-sync-key-2026';
        if (apiKey !== validApiKey) {
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
     * Periodically called by the desktop agent to upsert asset status and check assignment resignation status.
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

        // 1. Look up the ITAsset by serialNumber
        const asset = await prisma.iTAsset.findUnique({
            where: { serialNumber },
            select: {
                id: true,
                serialNumber: true,
                assignedUserId: true,
                brand: true,
                model: true
            }
        });

        if (!asset) {
            return null; // Signals a 404 (Asset not registered)
        }

        // Keep existing brand/model if already set to a valid non-default value in database.
        // This prevents the agent from overwriting nice manually-entered data with raw WMI codes or "Unknown".
        const currentBrandValid = asset.brand && asset.brand.trim() !== "" && asset.brand.toLowerCase() !== "unknown";
        const newBrandValid = brand && brand.trim() !== "" && brand.toLowerCase() !== "unknown";
        const finalBrand = currentBrandValid ? asset.brand : (newBrandValid ? brand : undefined);

        const invalidModels = ["unknown", "pc", "system product name", "system product", "to be filled by o.e.m."];
        const currentModelValid = asset.model && asset.model.trim() !== "" && !invalidModels.includes(asset.model.toLowerCase().trim());
        const newModelValid = model && model.trim() !== "" && !invalidModels.includes(model.toLowerCase().trim());
        const finalModel = currentModelValid ? asset.model : (newModelValid ? model : undefined);

        // 2. Update asset details
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
                lastSeenEmployeeUsername: employeeUsername,
                lastSeenEmployeeNumber: employeeNumber,
                lastSyncedAt: new Date()
            }
        });

        // 3. Log the sync event to Audit log (asset_sync_log)
        await prisma.assetSyncLog.create({
            data: {
                assetId: asset.id,
                reportedEmployeeNumber: employeeNumber,
                reportedEmployeeUsername: employeeUsername,
                ipAddress: clientIp,
                syncedAt: new Date()
            }
        });

        // 4. Look up assigned employee (User) if present
        let employeeStatus = 'unknown';
        let assignedEmployeeName: string | null = null;
        let assignedEmployeeNumber: string | null = null;

        if (asset.assignedUserId) {
            const employee = await prisma.user.findUnique({
                where: { id: asset.assignedUserId },
                select: {
                    name: true,
                    employeeId: true,
                    status: true
                }
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
            assetId: generateAssetId(serialNumber),
            employeeStatus,
            assignedEmployeeName,
            assignedEmployeeNumber
        };
    }

    /**
     * Registers a new asset and flags it for IT/HR manual review (does not auto-assign).
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

        // Check if ITAsset already exists
        const existingAsset = await prisma.iTAsset.findUnique({
            where: { serialNumber },
            select: { id: true, serialNumber: true }
        });

        if (existingAsset) {
            return {
                success: true,
                assetId: generateAssetId(serialNumber)
            };
        }

        // Create the ITAsset, flagged for assignment review
        await prisma.iTAsset.create({
            data: {
                assetNumber: `SLT-AGENT-IT-${Math.floor(100000 + Math.random() * 900000)}`,
                serialNumber,
                deviceType: 'LAPTOP',
                brand: brand || 'Unknown',
                model: model || 'Unknown',
                computerName,
                osVersion,
                pendingAssignmentReview: true, // Requires explicit confirmation
                employeeUsername,
                lastSeenEmployeeUsername: employeeUsername,
                lastSeenEmployeeNumber: employeeNumber,
                assignedUserId: null,
                department,
                location
            }
        });

        return {
            success: true,
            assetId: generateAssetId(serialNumber)
        };
    }
}
