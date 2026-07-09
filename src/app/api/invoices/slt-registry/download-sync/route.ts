import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { BOMInvoiceService } from '@/services/finance/bom-invoice.service';

const CONFIG_FILE = path.join(process.cwd(), 'src/data/slt-config.json');

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { bomPath } = body;

        if (!bomPath) {
            return NextResponse.json(
                { success: false, message: 'Invalid payload: bomPath is required' },
                { status: 400 }
            );
        }

        // Fetch auth headers
        const userId = request.headers.get('x-user-id') || 'ADMIN';
        const userRole = request.headers.get('x-user-role');

        if (userRole === 'AREA_COORDINATOR' || userRole === 'QC_OFFICER') {
            return NextResponse.json(
                { success: false, message: 'Permission Denied: Unauthorized to import BOM invoices.' },
                { status: 403 }
            );
        }

        // Load SLT cookie configuration
        let sltCookie = '';
        if (fs.existsSync(CONFIG_FILE)) {
            try {
                const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
                sltCookie = config.cookie || '';
            } catch (e) {
                console.error('Failed to read slt-config:', e);
            }
        }

        if (!sltCookie) {
            return NextResponse.json(
                { success: false, message: 'SLT portal session cookie not set. Please save your cookie in the settings first.' },
                { status: 400 }
            );
        }

        // Format path for the file download URL (replace slashes with hyphens)
        const cleanPath = bomPath.trim().replace(/\//g, '-');
        const downloadUrl = `https://serviceportal.slt.lk/iShamp/files/${cleanPath}.csv`;

        console.log(`Downloading original BOM CSV from SLT portal: ${downloadUrl}`);
        
        const res = await fetch(downloadUrl, {
            headers: {
                'Cookie': sltCookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            next: { revalidate: 0 }
        });

        if (!res.ok) {
            return NextResponse.json(
                { success: false, message: `Failed to download file from SLT portal (HTTP ${res.status})` },
                { status: 502 }
            );
        }

        const csvText = await res.text();

        // Check if redirecting to login page
        if (csvText.includes('login') || csvText.includes('Username') || csvText.includes('Password') || csvText.includes('<!DOCTYPE html>')) {
            return NextResponse.json(
                { success: false, message: 'SLT portal session has expired. Please copy and save your active session cookie again.', code: 'SESSION_EXPIRED' },
                { status: 401 }
            );
        }

        // Process the CSV text, match orders, update PAT statuses, and generate client invoice
        const result = await BOMInvoiceService.processBOMCSVImport(csvText, userId, bomPath);

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('BOM Download & Sync Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return NextResponse.json(
            { success: false, message: 'Failed to download and sync BOM sheet', error: errorMessage },
            { status: 500 }
        );
    }
}
