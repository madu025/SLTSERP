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
      department,
      location
    } = body;

    if (!serialNumber) {
      return NextResponse.json(
        { success: false, message: 'serialNumber is required' },
        { status: 400 }
      );
    }

    // Check if it already exists
    let asset = await prisma.iTAsset.findUnique({
      where: { serialNumber }
    });

    if (asset) {
      return NextResponse.json({
        success: true,
        message: 'Asset already registered',
        assetId: asset.assetNumber
      });
    }

    // Create the asset
    const assetNumber = `AGENT-${serialNumber}`;
    asset = await prisma.iTAsset.create({
      data: {
        assetNumber,
        serialNumber,
        deviceType: 'LAPTOP', // Default to LAPTOP
        brand: 'Unknown',
        model: 'PC',
        status: 'ACTIVE',
        computerName,
        osVersion,
        employeeUsername,
        department,
        location,
        lastSyncedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      assetId: asset.assetNumber
    }, { status: 201 });
  } catch (error: any) {
    console.error('[AGENT-REGISTER-ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
