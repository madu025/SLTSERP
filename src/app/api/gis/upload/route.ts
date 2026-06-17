// ============================================================================
// POST /api/gis/upload - Upload GIS files for ingestion
// ============================================================================
// Accepts GeoJSON files and creates an import session for processing
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { GISImportService } from '@/services/GISImportService';
import { logger } from '@/lib/logger';
import type { GISUploadRequest, GISLayerType } from '@/types/gis';

export async function POST(request: NextRequest) {
  logger.info('[GIS-UPLOAD] Received GIS file upload request');

  try {
    const contentType = request.headers.get('content-type') || '';

    let body: GISUploadRequest;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data (file upload via browser)
      const formData = await request.formData();

      const files: GISUploadRequest['files'] = [];
      const fileEntries = formData.getAll('files') as File[];

      // Parse the parallel layerTypes JSON array sent by the client
      // (one layer type per file, in the same order as fileEntries)
      const layerTypesRaw = formData.get('layerTypes') as string | null;
      let clientLayerTypes: (GISLayerType | undefined)[] = [];
      if (layerTypesRaw) {
        try {
          const parsed = JSON.parse(layerTypesRaw);
          if (Array.isArray(parsed)) {
            clientLayerTypes = parsed as (GISLayerType | undefined)[];
          }
        } catch {
          logger.warn('[GIS-UPLOAD] Invalid layerTypes JSON, ignoring client overrides');
        }
      }

      for (let i = 0; i < fileEntries.length; i++) {
        const file = fileEntries[i];
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = buffer.toString('base64');

        const clientLayerType = clientLayerTypes[i];
        files.push({
          fileName: file.name,
          fileData: base64,
          // Pass the client-selected layer type; service will auto-detect if undefined/UNKNOWN
          layerType:
            clientLayerType && clientLayerType !== 'UNKNOWN'
              ? clientLayerType
              : undefined,
        });
      }

      body = {
        files,
        projectName: (formData.get('projectName') as string) || undefined,
        region: (formData.get('region') as string) || undefined,
        district: (formData.get('district') as string) || undefined,
        createdById: (formData.get('createdById') as string) || 'system',
      };
    } else {
      // Handle JSON body (API-to-API)
      body = await request.json();
    }

    if (!body.files || body.files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided. At least one GIS file is required.' },
        { status: 400 }
      );
    }

    if (body.files.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 files per upload session.' },
        { status: 400 }
      );
    }

    // Validate file sizes (max 50MB per file)
    for (const file of body.files) {
      const sizeInBytes = Buffer.from(file.fileData, 'base64').length;
      if (sizeInBytes > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.fileName} exceeds 50MB limit.` },
          { status: 400 }
        );
      }
    }

    const result = await GISImportService.uploadFiles(body);

    logger.info(
      `[GIS-UPLOAD] Session created: ${result.importId} with ${body.files.length} file(s)`
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    logger.error('[GIS-UPLOAD] Upload failed', {
      error: err.message,
      stack: err.stack,
    });

    return NextResponse.json(
      {
        error: 'GIS upload failed',
        message: err.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
