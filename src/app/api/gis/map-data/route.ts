import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { requireAuth } from '@/lib/server-utils';
import { handleApiError } from '@/lib/api-utils';

import { safe } from '@/utils/safe-await.util';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
  // Secure endpoint
  const [authErr] = await safe(requireAuth());
  if (authErr) {
    return handleApiError(authErr);
  }

  // Fetch active GIS routes and global stats
  const [dataErr, data] = await safe(GISRouteService.getActiveRoutesAndStats());

  if (dataErr) {
    return handleApiError(dataErr);
  }

  return NextResponse.json(data);
}, { rawResponse: true });
