import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET all contractors
export async function GET() {
    try {
        const contractors = await prisma.contractor.findMany({
            include: {
                teamMembers: true,
                _count: {
                    select: { invoices: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json(contractors);
    } catch (error) {
        console.error('Error fetching contractors:', error);
        return NextResponse.json({ message: 'Failed to fetch contractors' }, { status: 500 });
    }
}

// POST - Create new contractor
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            name,
            address,
            registrationNumber,
            brNumber,
            status,
            registrationFeePaid,
            agreementSigned,
            agreementDate,
            bankAccountNumber,
            bankBranch,
            teamMembers
        } = body;

        // Check if registration number already exists
        const existing = await prisma.contractor.findUnique({
            where: { registrationNumber }
        });

        if (existing) {
            return NextResponse.json(
                { message: 'A contractor with this registration number already exists' },
                { status: 400 }
            );
        }

        const contractor = await prisma.contractor.create({
            data: {
                name,
                address,
                registrationNumber,
                brNumber,
                status: status || 'PENDING',
                registrationFeePaid: registrationFeePaid || false,
                agreementSigned: agreementSigned || false,
                agreementDate: agreementDate ? new Date(agreementDate) : null,
                bankAccountNumber,
                bankBranch,
                teamMembers: {
                    create: teamMembers || []
                }
            },
            include: {
                teamMembers: true
            }
        });

        return NextResponse.json(contractor, { status: 201 });
    } catch (error) {
        console.error('Error creating contractor:', error);
        return NextResponse.json({ message: 'Failed to create contractor' }, { status: 500 });
    }
}

// PUT - Update contractor
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            id,
            name,
            address,
            registrationNumber,
            brNumber,
            status,
            registrationFeePaid,
            agreementSigned,
            agreementDate,
            bankAccountNumber,
            bankBranch,
            teamMembers
        } = body;

        if (!id) {
            return NextResponse.json({ message: 'Contractor ID is required' }, { status: 400 });
        }

        // Delete existing team members and create new ones
        await prisma.teamMember.deleteMany({
            where: { contractorId: id }
        });

        const contractor = await prisma.contractor.update({
            where: { id },
            data: {
                name,
                address,
                registrationNumber,
                brNumber,
                status,
                registrationFeePaid,
                agreementSigned,
                agreementDate: agreementDate ? new Date(agreementDate) : null,
                bankAccountNumber,
                bankBranch,
                teamMembers: {
                    create: teamMembers || []
                }
            },
            include: {
                teamMembers: true
            }
        });

        return NextResponse.json(contractor);
    } catch (error) {
        console.error('Error updating contractor:', error);
        return NextResponse.json({ message: 'Failed to update contractor' }, { status: 500 });
    }
}

// DELETE - Delete contractor
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ message: 'Contractor ID is required' }, { status: 400 });
        }

        // Check if contractor has invoices
        const contractor = await prisma.contractor.findUnique({
            where: { id },
            include: { _count: { select: { invoices: true } } }
        });

        if (contractor && contractor._count.invoices > 0) {
            return NextResponse.json(
                { message: 'Cannot delete contractor with existing invoices' },
                { status: 400 }
            );
        }

        await prisma.contractor.delete({
            where: { id }
        });

        return NextResponse.json({ message: 'Contractor deleted successfully' });
    } catch (error) {
        console.error('Error deleting contractor:', error);
        return NextResponse.json({ message: 'Failed to delete contractor' }, { status: 500 });
    }
}
