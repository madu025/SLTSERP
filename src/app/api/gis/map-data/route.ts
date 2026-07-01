import { NextResponse } from 'next/server';
import { primaryClient as prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/server-utils';
import { handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    // Secure endpoint
    await requireAuth();

    // Fetch active GIS routes for all projects
    const routes = await prisma.gISRoute.findMany({
      where: { isActive: true },
      select: {
        id: true,
        projectId: true,
        name: true,
        versionType: true,
        routeLength: true,
        geojsonData: true,
        project: {
          select: {
            name: true,
            projectCode: true
          }
        }
      }
    });

    return NextResponse.json(routes);
  } catch (error) {
    return handleApiError(error);
  }
}
