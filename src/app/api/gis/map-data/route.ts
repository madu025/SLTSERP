import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { handleApiError } from '@/lib/api-utils';
import { toSerializable } from '@/lib/server-utils';

import { safe } from '@/utils/safe-await.util';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
  // Active GIS routes and stats, limited to the caller's OPMC scope
  const [dataErr, data] = await safe(GISRouteService.getActiveRoutesAndStats(params._userId));

  if (dataErr) {
    return handleApiError(dataErr);
  }

  // routeLength / cable length are Prisma Decimals; the map calls `.toFixed()` on them, so send numbers.
  return NextResponse.json(toSerializable(data));
}, { rawResponse: true });
