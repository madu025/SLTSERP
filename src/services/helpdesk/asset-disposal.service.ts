import { prisma } from '@/lib/prisma';
import { ApprovalStatus, DisposalReason, ITAssetStatus } from '@prisma/client';
import { AppError } from '@/lib/error';

export interface DisposalFilterQuery {
    status?: string;
    search?: string;
}

export class AssetDisposalService {
    static async getDisposalRequests(filters: DisposalFilterQuery) {
        const { status: statusParam, search } = filters;
        const whereClause: Record<string, unknown> = {};

        if (statusParam && statusParam !== 'ALL' && Object.values(ApprovalStatus).includes(statusParam as ApprovalStatus)) {
            whereClause.status = statusParam as ApprovalStatus;
        }

        if (search) {
            whereClause.OR = [
                { asset: { serialNumber: { contains: search, mode: 'insensitive' } } },
                { asset: { assetNumber: { contains: search, mode: 'insensitive' } } },
                { asset: { model: { contains: search, mode: 'insensitive' } } },
                { requestedBy: { name: { contains: search, mode: 'insensitive' } } }
            ];
        }

        const requests = await prisma.assetDisposalRequest.findMany({
            where: whereClause,
            include: {
                asset: {
                    select: {
                        id: true,
                        assetNumber: true,
                        serialNumber: true,
                        brand: true,
                        model: true,
                        deviceType: true,
                        purchaseCost: true,
                        status: true
                    }
                },
                requestedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true
                    }
                },
                approvedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const formattedRequests = requests.map(r => ({
            ...r,
            asset: {
                ...r.asset,
                assetTag: r.asset.assetNumber,
                deviceName: `${r.asset.brand} ${r.asset.model}`
            }
        }));

        const pendingCount = await prisma.assetDisposalRequest.count({ where: { status: ApprovalStatus.PENDING } });
        const approvedCount = await prisma.assetDisposalRequest.count({ where: { status: ApprovalStatus.APPROVED } });
        const rejectedCount = await prisma.assetDisposalRequest.count({ where: { status: ApprovalStatus.REJECTED } });

        const totalSalvage = requests
            .filter(r => r.status === ApprovalStatus.APPROVED)
            .reduce((sum, r) => sum + Number(r.salvageValue || 0), 0);

        return {
            requests: formattedRequests,
            stats: {
                total: requests.length,
                pending: pendingCount,
                approved: approvedCount,
                rejected: rejectedCount,
                totalSalvage
            }
        };
    }

    static async createDisposalRequest(userId: string, data: { assetId: string; reason: DisposalReason; salvageValue?: number }) {
        const asset = await prisma.iTAsset.findUnique({
            where: { id: data.assetId }
        });

        if (!asset) {
            throw AppError.notFound('Asset not found');
        }

        const existingPending = await prisma.assetDisposalRequest.findFirst({
            where: {
                assetId: data.assetId,
                status: ApprovalStatus.PENDING
            }
        });

        if (existingPending) {
            throw AppError.badRequest('A pending disposal request already exists for this asset.');
        }

        const request = await prisma.assetDisposalRequest.create({
            data: {
                assetId: data.assetId,
                requestedById: userId,
                reason: data.reason,
                salvageValue: data.salvageValue || 0,
                status: ApprovalStatus.PENDING
            }
        });

        return { request };
    }

    static async processDisposalApproval(userId: string, data: { requestId: string; action: 'APPROVE' | 'REJECT' }) {
        return await prisma.$transaction(async (tx) => {
            const request = await tx.assetDisposalRequest.findUnique({
                where: { id: data.requestId }
            });

            if (!request) {
                throw AppError.notFound('Disposal request not found');
            }

            if (request.status !== ApprovalStatus.PENDING) {
                throw AppError.badRequest('Request is already processed');
            }

            if (request.requestedById === userId) {
                throw AppError.forbidden('Maker cannot be Checker. Another authorized user must approve this request.');
            }

            const newStatus = data.action === 'APPROVE' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

            const updatedRequest = await tx.assetDisposalRequest.update({
                where: { id: data.requestId },
                data: {
                    status: newStatus,
                    approvedById: userId
                }
            });

            if (newStatus === ApprovalStatus.APPROVED) {
                await tx.iTAsset.update({
                    where: { id: request.assetId },
                    data: {
                        status: ITAssetStatus.DISPOSED
                    }
                });
            }

            return { updatedRequest };
        });
    }
}
