const fs = require('fs');

const files = [
    'd:/MyProject/SLTSERP/src/app/api/contractors/balance-sheet/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/contractors/balance-sheet/generate/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/contractors/balance-sheet/preview/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/contractors/public/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/contractors/public-register/[token]/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/contractors/renew-link/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/contractors/teams/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/contractors/teams/[teamId]/stores/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/contractors/[id]/resend-link/route.ts',
    'd:/MyProject/SLTSERP/src/app/api/contractors/[id]/teams/route.ts'
];

files.forEach(f => {
    if (!fs.existsSync(f)) {
        console.log("File not found:", f);
        return;
    }
    let c = fs.readFileSync(f, 'utf8');
    
    // Check if already modified
    if (c.includes('apiHandler')) {
        console.log("Already wrapped:", f);
        return;
    }

    c = c.replace(/import \{ NextResponse \} from 'next\/server';/, "import { apiHandler } from '@/lib/api-handler';\nimport { NextResponse } from 'next/server';");
    c = c.replace(/import \{ NextResponse, NextRequest \} from 'next\/server';/, "import { apiHandler } from '@/lib/api-handler';\nimport { NextResponse, NextRequest } from 'next/server';");
    c = c.replace(/import \{ NextRequest, NextResponse \} from 'next\/server';/, "import { apiHandler } from '@/lib/api-handler';\nimport { NextRequest, NextResponse } from 'next/server';");

    c = c.replace(/export async function GET\([^)]*\) \{/g, 'export const GET = apiHandler(async (_req, _params, _body) => {');
    c = c.replace(/export async function POST\([^)]*\) \{/g, 'export const POST = apiHandler(async (_req, _params, _body) => {');
    c = c.replace(/export async function PUT\([^)]*\) \{/g, 'export const PUT = apiHandler(async (_req, _params, _body) => {');
    c = c.replace(/export async function PATCH\([^)]*\) \{/g, 'export const PATCH = apiHandler(async (_req, _params, _body) => {');
    c = c.replace(/export async function DELETE\([^)]*\) \{/g, 'export const DELETE = apiHandler(async (_req, _params, _body) => {');
    
    fs.writeFileSync(f, c);
    console.log("Processed:", f);
});
