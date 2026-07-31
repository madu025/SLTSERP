import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
  // We can group them by entityType for easy lookup on the frontend
  const statuses = await prisma.workflowStatus.findMany({
    orderBy: { createdAt: 'asc' } // Preserve insertion order which mimics the config order
  });

  const grouped: Record<string, any[]> = {};
  for (const s of statuses) {
    if (!grouped[s.entityType]) {
      grouped[s.entityType] = [];
    }
    grouped[s.entityType].push({
      value: s.value,
      label: s.label,
      badgeColor: s.badgeColor
    });
  }

  return grouped;
});
