import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const accountCode = searchParams.get('accountCode');
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    if (!accountCode) {
        throw AppError.badRequest('Query parameter accountCode is required');
    }

    const coa = await prisma.chartOfAccount.findUnique({
        where: { code: accountCode }
    });

    if (!coa) {
        throw AppError.notFound(`Account code '${accountCode}' not found in Chart of Accounts`);
    }

    const dateFilter: Record<string, Date> = {};
    if (fromStr) dateFilter.gte = new Date(fromStr);
    if (toStr) dateFilter.lte = new Date(toStr);

    const entryWhere: Prisma.JournalEntryWhereInput = {
        status: { not: 'REVERSED' },
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter })
    };

    const lines = await prisma.journalLine.findMany({
        where: {
            accountCode,
            entry: entryWhere
        },
        include: {
            entry: true
        },
        orderBy: {
            entry: { date: 'asc' }
        }
    });

    // Calculate running balances
    let runningBalance = 0;
    const drilldownRows = lines.map((l) => {
        const debit = Number(l.debit);
        const credit = Number(l.credit);

        // Account normal balance sign
        if (coa.type === 'ASSET' || coa.type === 'EXPENSE') {
            runningBalance += debit - credit;
        } else {
            runningBalance += credit - debit;
        }

        return {
            id: l.id,
            entryId: l.entryId,
            date: l.entry.date.toISOString(),
            referenceId: l.entry.referenceId,
            referenceType: l.entry.referenceType,
            description: l.description || l.entry.description,
            debit,
            credit,
            runningBalance
        };
    });

    return {
        account: {
            code: coa.code,
            name: coa.name,
            type: coa.type
        },
        totalRows: drilldownRows.length,
        finalBalance: runningBalance,
        rows: drilldownRows
    };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT']
});
