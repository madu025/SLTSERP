// ============================================================================
// POST /api/gis/process - Process uploaded GIS files
// ============================================================================
// Triggers the full GIS ingestion pipeline:
// Parse -> Validate -> Detect Type -> BOQ -> Assets -> Survey -> Permits -> Workflow
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { GISImportService } from '@/services/GISImportService';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  logger.info('[GIS-PROCESS] Received GIS processing request');

  try {
    const body = await request.json();
    const { importId } = body;

    if (!importId) {
      return NextResponse.json(
        { error: 'importId is required.' },
        { status: 400 }
      );
    }

    // Check if session exists
    const session = GISImportService.getSession(importId);
    if (!session) {
      return NextResponse.json(
        { error: `Import session ${importId} not found.` },
        { status: 404 }
      );
    }

    if (session.status === 'COMPLETED') {
      return NextResponse.json(
        { error: `Import session ${importId} has already been processed.` },
        { status: 409 }
      );
    }

    if (session.status === 'PROCESSING') {
      return NextResponse.json(
        { error: `Import session ${importId} is currently being processed.` },
        { status: 409 }
      );
    }

    // Execute the full processing pipeline
    logger.info(`[GIS-PROCESS] Starting processing for session ${importId}`);
    const result = await GISImportService.processImport(importId);

    logger.info(
      `[GIS-PROCESS] Completed processing for ${importId}. ` +
      `Project: ${result.result.projectCode}`
    );

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    logger.error('[GIS-PROCESS] Processing failed', {
      error: err.message,
      stack: err.stack,
    });

    return NextResponse.json(
      {
        error: 'GIS processing failed',
        message: err.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
