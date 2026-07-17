import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWT } from '@/lib/auth';

const AGENT_API_KEY = process.env.AGENT_API_KEY || 'slts-agent-secure-sync-key-2026';

async function isAuthorized(req: Request): Promise<boolean> {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey && apiKey === AGENT_API_KEY) {
    return true;
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token);
    if (payload && payload.isAgent === true) {
      return true;
    }
  }

  return false;
}

export async function POST(req: Request) {
  try {
    if (!(await isAuthorized(req))) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      computerName,
      serialNumber,
      osVersion,
      employeeUsername,
      employeeId,
      ipAddress,
      macAddress,
    } = body;

    if (!serialNumber) {
      return NextResponse.json(
        { success: false, message: 'serialNumber is required' },
        { status: 400 }
      );
    }

    const asset = await prisma.iTAsset.findUnique({
      where: { serialNumber }
    });

    if (!asset) {
      return NextResponse.json(
        {
          success: false,
          message: 'Asset not registered. Contact IT.',
          requiresRegistration: true
        },
        { status: 404 }
      );
    }

    // Check if any fields changed
    const hasChanges =
      asset.computerName !== computerName ||
      asset.osVersion !== osVersion ||
      asset.employeeUsername !== employeeUsername ||
      asset.ipAddress !== ipAddress ||
      asset.macAddress !== macAddress;

    // Update the asset
    await prisma.iTAsset.update({
      where: { id: asset.id },
      data: {
        computerName: computerName || asset.computerName,
        osVersion: osVersion || asset.osVersion,
        employeeUsername: employeeUsername || asset.employeeUsername,
        ipAddress: ipAddress || asset.ipAddress,
        macAddress: macAddress || asset.macAddress,
        lastSyncedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: hasChanges ? 'Asset record updated' : 'No changes detected',
      assetId: asset.assetNumber
    });
  } catch (error: any) {
    console.error('[AGENT-SYNC-ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
