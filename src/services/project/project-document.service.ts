import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';

interface CreateDocumentInput {
    title: string;
    description?: string | null;
    category: string;
    fileUrl: string;
    uploadedById: string;
}

interface UpdateDocumentInput {
    documentId: string;
    fileUrl: string;
    uploadedById: string;
    changeSummary?: string | null;
}

export class ProjectDocumentService {
    static async getDocuments(projectId: string) {
        return await prisma.projectDocument.findMany({
            where: { projectId },
            include: {
                versions: {
                    orderBy: { versionNumber: 'desc' }
                },
                uploadedBy: {
                    select: { id: true, name: true, email: true }
                },
                approvals: {
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
    }

    static async updateDocumentVersion(data: UpdateDocumentInput) {
        const { documentId, fileUrl, uploadedById, changeSummary } = data;

        const document = await prisma.projectDocument.findUnique({
            where: { id: documentId }
        });

        if (!document) {
            throw AppError.notFound('Document not found');
        }

        const nextVersion = document.currentVersion + 1;

        return await prisma.$transaction(async (tx) => {
            const doc = await tx.projectDocument.update({
                where: { id: documentId },
                data: {
                    currentVersion: nextVersion,
                    fileUrl,
                    status: 'UNDER_REVIEW'
                }
            });

            await tx.projectDocumentVersion.create({
                data: {
                    documentId,
                    versionNumber: nextVersion,
                    fileUrl,
                    changeSummary: changeSummary || 'Published new version',
                    uploadedById
                }
            });

            return doc;
        });
    }

    static async createDocument(projectId: string, data: CreateDocumentInput) {
        const { title, description, category, fileUrl, uploadedById } = data;

        return await prisma.$transaction(async (tx) => {
            const doc = await tx.projectDocument.create({
                data: {
                    projectId,
                    title,
                    description: description || null,
                    category,
                    fileUrl,
                    uploadedById,
                    status: 'DRAFT',
                    currentVersion: 1
                }
            });

            await tx.projectDocumentVersion.create({
                data: {
                    documentId: doc.id,
                    versionNumber: 1,
                    fileUrl,
                    changeSummary: 'Initial upload',
                    uploadedById
                }
            });

            return doc;
        });
    }
}