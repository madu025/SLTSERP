import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: List all documents with version history for a project
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const documents = await prisma.projectDocument.findMany({
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

        return NextResponse.json(documents);
    } catch (error) {
        console.error('Error fetching project documents:', error);
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }
}

// POST: Add new document or publish a new version
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { title, description, category, fileUrl, uploadedById, documentId, changeSummary } = body;

        if (!fileUrl || !uploadedById) {
            return NextResponse.json({ error: 'fileUrl and uploadedById are required' }, { status: 400 });
        }

        // Check if updating an existing document with a new version
        if (documentId) {
            const document = await prisma.projectDocument.findUnique({
                where: { id: documentId }
            });

            if (!document) {
                return NextResponse.json({ error: 'Document not found' }, { status: 404 });
            }

            const nextVersion = document.currentVersion + 1;

            const updatedDoc = await prisma.$transaction(async (tx) => {
                // Update document state
                const doc = await tx.projectDocument.update({
                    where: { id: documentId },
                    data: {
                        currentVersion: nextVersion,
                        fileUrl,
                        status: 'UNDER_REVIEW' // Reset approval state for new version
                    }
                });

                // Write version log
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

            return NextResponse.json(updatedDoc);
        } else {
            // Registering a brand new document
            if (!title || !category) {
                return NextResponse.json({ error: 'Title and category are required' }, { status: 400 });
            }

            const newDoc = await prisma.$transaction(async (tx) => {
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

            return NextResponse.json(newDoc);
        }
    } catch (error) {
        console.error('Error saving project document:', error);
        return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
    }
}
