import { NextResponse } from 'next/server';
import { InvoiceService } from '@/services/finance/invoice.service';
import { apiHandler } from '@/lib/api-handler';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

// GET /api/finance/invoice - List invoices (secured with RBAC)
export const GET = apiHandler(async (req) => {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const approvalStatus = url.searchParams.get('approvalStatus') || '';

    const data = await InvoiceService.getInvoices({ page, limit, search, approvalStatus });

    return NextResponse.json({
        success: true,
        data
    });
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS
});
