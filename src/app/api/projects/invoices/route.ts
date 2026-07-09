import { NextRequest, NextResponse } from 'next/server';
import { ProjectInvoiceService } from '@/services/project-invoice.service';

// GET /api/projects/invoices?projectId=xxx - List invoices by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const allClient = searchParams.get('allClient') === 'true';

        if (allClient) {
            const invoices = await ProjectInvoiceService.getAllClientInvoices();
            return NextResponse.json(invoices);
        }

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const invoices = await ProjectInvoiceService.getInvoices(projectId);
        return NextResponse.json(invoices);
    } catch (error: unknown) {
        console.error('Error fetching invoices:', error);
        return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
}

// POST /api/projects/invoices - Create a new invoice
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, title, items } = body;

        if (!projectId || !title || !items?.length) {
            return NextResponse.json(
                { error: 'projectId, title, and items are required' },
                { status: 400 }
            );
        }

        const invoice = await ProjectInvoiceService.createInvoice(body);
        return NextResponse.json(invoice, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating invoice:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PROJECT_NOT_FOUND') {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }
}

// PATCH /api/projects/invoices - Update invoice status or details
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updateFields } = body;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const invoice = await ProjectInvoiceService.updateInvoice(id, updateFields);
        return NextResponse.json(invoice);
    } catch (error: unknown) {
        console.error('Error updating invoice:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'INVOICE_NOT_FOUND') {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }
}

// DELETE /api/projects/invoices - Delete a DRAFT invoice
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        await ProjectInvoiceService.deleteInvoice(id);
        return NextResponse.json({ message: 'Invoice deleted successfully' });
    } catch (error: unknown) {
        console.error('Error deleting invoice:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'INVOICE_NOT_FOUND') {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }
        if (errorMsg === 'DRAFT_ONLY_DELETION') {
            return NextResponse.json(
                { error: 'Only DRAFT invoices can be deleted' },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
    }
}
