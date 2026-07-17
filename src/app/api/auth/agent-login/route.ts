import { NextResponse } from 'next/server';
import { signJWT } from '@/lib/auth';

const AGENT_API_KEY = process.env.AGENT_API_KEY || 'slts-agent-secure-sync-key-2026';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey || apiKey !== AGENT_API_KEY) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = await signJWT({ isAgent: true }, '24h');

    return NextResponse.json({
      success: true,
      token,
      expiresIn: 86400
    });
  } catch (error: any) {
    console.error('[AGENT-LOGIN-ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
