import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { QFieldCloudSyncService } from '@/services/qfieldcloud-sync.service';

/**
 * GET /api/projects/[id]/export/gpkg
 * Export the companion GeoPackage (.gpkg) file from QFieldCloud
 * for the project's connected survey project.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // 1. Fetch project's gisMapping to get qfieldProjectId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { gisMapping: true, projectCode: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const gisMapping = project.gisMapping as Record<string, unknown> | null;
    const qfieldProjectId = gisMapping?.qfieldProjectId as string | undefined;

    if (!qfieldProjectId) {
      return NextResponse.json(
        { error: 'No QFieldCloud project linked to this project. Please connect a QFieldCloud project first.' },
        { status: 400 }
      );
    }

    // 2. Use QFieldCloudSyncService to authenticate and fetch files
    const syncService = new QFieldCloudSyncService();

    // Reflexively access private fetchWithAuth by instantiating a lightweight auth
    const baseUrl = process.env.NEXT_PUBLIC_QFIELD_API_URL || 'http://localhost:8100';

    // Authenticate
    const authRes = await fetch(`${baseUrl}/api/v1/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.QFIELD_ADMIN_USER || 'admin',
        password: process.env.QFIELD_ADMIN_PASS || 'admin',
      }),
    });

    if (!authRes.ok) {
      return NextResponse.json(
        { error: 'Failed to authenticate with QFieldCloud' },
        { status: 502 }
      );
    }

    const authData = await authRes.json();
    const token = authData.token || authData.access_token;

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to obtain QFieldCloud auth token' },
        { status: 502 }
      );
    }

    const authHeaders = { Authorization: `Token ${token}` };

    // 3. List project files to find .gpkg file
    const filesRes = await fetch(`${baseUrl}/api/v1/projects/${qfieldProjectId}/files/`, {
      headers: authHeaders,
    });

    if (!filesRes.ok) {
      return NextResponse.json(
        { error: `Failed to list QFieldCloud project files (status ${filesRes.status})` },
        { status: 502 }
      );
    }

    const filesData = await filesRes.json();

    // Flatten files from response — QFieldCloud may return { results: [...] } or [...]
    const filesList: Array<{ name: string; size?: number }> = Array.isArray(filesData)
      ? filesData
      : (filesData as Record<string, unknown>).results
        ? ((filesData as Record<string, unknown>).results as Array<{ name: string; size?: number }>)
        : [];

    // Find the .gpkg file
    const gpkgFile = filesList.find((f) => f.name?.toLowerCase().endsWith('.gpkg'));

    if (!gpkgFile || !gpkgFile.name) {
      return NextResponse.json(
        { error: 'No GeoPackage (.gpkg) file found in the QFieldCloud project' },
        { status: 404 }
      );
    }

    // 4. Download the GPKG binary from QFieldCloud
    const downloadRes = await fetch(
      `${baseUrl}/api/v1/files/${qfieldProjectId}/${encodeURIComponent(gpkgFile.name)}/`,
      {
        headers: authHeaders,
      }
    );

    if (!downloadRes.ok) {
      return NextResponse.json(
        { error: `Failed to download GPKG file from QFieldCloud (status ${downloadRes.status})` },
        { status: 502 }
      );
    }

    const gpkgBuffer = await downloadRes.arrayBuffer();

    // 5. Stream back as download
    const filename = `${project.projectCode || 'project'}_survey.gpkg`;

    return new NextResponse(gpkgBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': gpkgBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('GPKG export error:', error);
    return NextResponse.json(
      { error: 'Failed to export GeoPackage file' },
      { status: 500 }
    );
  }
}