import { prisma } from '@/lib/prisma';
import { AppError, ErrorCode } from '@/lib/error';

export class ProjectExportService {
    static async getGPKGFile(projectId: string) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { gisMapping: true, projectCode: true },
        });

        if (!project) {
            throw AppError.notFound('Project not found');
        }

        const gisMapping = project.gisMapping as Record<string, unknown> | null;
        const qfieldProjectId = gisMapping?.qfieldProjectId as string | undefined;

        if (!qfieldProjectId) {
            throw AppError.badRequest('No QFieldCloud project linked to this project. Please connect a QFieldCloud project first.');
        }

        const baseUrl = process.env.NEXT_PUBLIC_QFIELD_API_URL || 'http://localhost:8100';

        const authRes = await fetch(`${baseUrl}/api/v1/auth/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: process.env.QFIELD_ADMIN_USER || 'admin',
                password: process.env.QFIELD_ADMIN_PASS || 'admin',
            }),
        });

        if (!authRes.ok) {
            throw new AppError('Failed to authenticate with QFieldCloud', ErrorCode.INTERNAL_ERROR, 502);
        }

        const authData = await authRes.json();
        const token = authData.token || authData.access_token;

        if (!token) {
            throw new AppError('Failed to obtain QFieldCloud auth token', ErrorCode.INTERNAL_ERROR, 502);
        }

        const authHeaders = { Authorization: `Token ${token}` };

        const filesRes = await fetch(`${baseUrl}/api/v1/projects/${qfieldProjectId}/files/`, {
            headers: authHeaders,
        });

        if (!filesRes.ok) {
            throw new AppError(`Failed to list QFieldCloud project files (status ${filesRes.status})`, ErrorCode.INTERNAL_ERROR, 502);
        }

        const filesData = await filesRes.json();

        const filesList: Array<{ name: string; size?: number }> = Array.isArray(filesData)
            ? filesData
            : (filesData as Record<string, unknown>).results
                ? ((filesData as Record<string, unknown>).results as Array<{ name: string; size?: number }>)
                : [];

        const gpkgFile = filesList.find((f) => f.name?.toLowerCase().endsWith('.gpkg'));

        if (!gpkgFile || !gpkgFile.name) {
            throw AppError.notFound('No GeoPackage (.gpkg) file found in the QFieldCloud project');
        }

        const downloadRes = await fetch(
            `${baseUrl}/api/v1/files/${qfieldProjectId}/${encodeURIComponent(gpkgFile.name)}/`,
            {
                headers: authHeaders,
            }
        );

        if (!downloadRes.ok) {
            throw new AppError(`Failed to download GPKG file from QFieldCloud (status ${downloadRes.status})`, ErrorCode.INTERNAL_ERROR, 502);
        }

        const gpkgBuffer = await downloadRes.arrayBuffer();
        const filename = `${project.projectCode || 'project'}_survey.gpkg`;

        return { gpkgBuffer, filename };
    }
}