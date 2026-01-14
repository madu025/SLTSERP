
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const invoice = await (prisma as any).invoice.findUnique({
            where: { id },
            include: {
                contractor: {
                    select: {
                        id: true,
                        name: true,
                        registrationNumber: true,
                        address: true,
                        bankName: true,
                        bankBranch: true,
                        bankAccountNumber: true,
                        contactNumber: true
                    }
                },
                sods: {
                    include: {
                        materialUsage: {
                            include: {
                                item: true
                            }
                        }
                    },
                    orderBy: {
                        completedAt: 'asc'
                    }
                }
            }
        });

        if (!invoice) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        return NextResponse.json(invoice);
    } catch (error) {
        console.error('Error fetching invoice details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
