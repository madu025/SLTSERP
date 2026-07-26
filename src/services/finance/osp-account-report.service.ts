import { prisma } from '@/lib/prisma';

export class OspAccountReportService {
    static async getDashboardReports() {
        // 1. Petty Cash Report Data
        const vouchers = await prisma.pettyCashVoucher.findMany({
            take: 200,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                voucherNumber: true,
                title: true,
                amount: true,
                category: true,
                status: true,
                rejectionReason: true,
                approvedAt: true,
                createdAt: true
            }
        });

        const pettyCashStats = {
            totalVouchers: vouchers.length,
            approvedCount: vouchers.filter((v) => v.status === 'APPROVED').length,
            rejectedCount: vouchers.filter((v) => v.status === 'REJECTED').length,
            totalApprovedAmount: vouchers
                .filter((v) => v.status === 'APPROVED')
                .reduce((sum, v) => sum + v.amount, 0),
            categoryBreakdown: {
                SUBSISTENCE: vouchers.filter((v) => v.category === 'SUBSISTENCE').reduce((s, v) => s + v.amount, 0),
                STAFF_WELFARE: vouchers.filter((v) => v.category === 'STAFF_WELFARE').reduce((s, v) => s + v.amount, 0),
                TRAVEL_TRANSPORT: vouchers.filter((v) => v.category === 'TRAVEL_TRANSPORT').reduce((s, v) => s + v.amount, 0),
                MISCELLANEOUS: vouchers.filter((v) => v.category === 'MISCELLANEOUS').reduce((s, v) => s + v.amount, 0)
            }
        };

        // 2. Fixed Assets Verification Report Data
        const assets = await prisma.fixedAsset.findMany({
            take: 300,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                assetNumber: true,
                name: true,
                category: true,
                subCategory: true,
                purchasedYear: true,
                locationCode: true,
                locationName: true,
                details: true,
                status: true,
                verifiedAt: true
            }
        });

        const fixedAssetStats = {
            totalAssets: assets.length,
            locationCount: new Set(assets.map((a) => a.locationCode)).size,
            categoryCounts: assets.reduce((acc: Record<string, number>, a) => {
                acc[a.category] = (acc[a.category] || 0) + 1;
                return acc;
            }, {})
        };

        // 3. Vehicle Fleet, Hiring Slips & Fuel Deposits Report Data
        const vehicles = await prisma.vMVehicle.findMany({
            take: 150,
            select: {
                id: true,
                registration_number: true,
                vehicle_type: true,
                model: true,
                status: true
            }
        });

        const payments = await prisma.ospVehicleHiringPayment.findMany({
            take: 100,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                accountName: true,
                amount: true,
                slipNo: true,
                slipDate: true,
                paidDate: true
            }
        });

        const fuelDeposits = await prisma.ospFuelDepositLedger.findMany({
            orderBy: { officeLocation: 'asc' },
            select: {
                id: true,
                officeLocation: true,
                stationName: true,
                actualDeposit: true
            }
        });

        const fleetStats = {
            totalVehicles: vehicles.length,
            totalMonthlyHireRate: 0,
            totalPaymentsLogged: payments.reduce((sum, p) => sum + p.amount, 0),
            totalFuelDeposits: fuelDeposits.reduce((sum, f) => sum + f.actualDeposit, 0)
        };

        // 4. Project Advances & IOU Aging Data
        const advances = await prisma.ospProjectAdvance.findMany({
            take: 150,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                refNumber: true,
                type: true,
                supplierName: true,
                description: true,
                invoiceNo: true,
                amount: true,
                vatAmount: true,
                totalAmount: true,
                status: true
            }
        });

        const ious = await prisma.ospPettyCashIou.findMany({
            take: 150,
            orderBy: { issuedDate: 'desc' },
            select: {
                id: true,
                iouNumber: true,
                staffName: true,
                type: true,
                amount: true,
                issuedDate: true,
                reason: true,
                noOfDays: true,
                status: true,
                remarks: true
            }
        });

        const advanceStats = {
            totalAdvances: advances.length,
            totalAdvanceAmount: advances.reduce((sum, a) => sum + a.amount, 0),
            totalVatClaimable: advances.reduce((sum, a) => sum + (a.vatAmount || 0), 0),
            totalIOUs: ious.length,
            totalIOUAmount: ious.reduce((sum, i) => sum + i.amount, 0),
            agingOver30DaysCount: ious.filter((i) => (i.noOfDays || 0) > 30).length
        };

        // 5. Property Rent Payments Data
        const propertyRents = await prisma.ospPropertyRentPayment.findMany({
            orderBy: { slipDate: 'desc' },
            select: {
                id: true,
                accountNo: true,
                supplierName: true,
                amount: true,
                category: true,
                slipNo: true,
                slipDate: true
            }
        });

        const rentStats = {
            totalRentRecords: propertyRents.length,
            totalRentPaid: propertyRents.reduce((sum, r) => sum + r.amount, 0)
        };

        return {
            pettyCash: { stats: pettyCashStats, vouchers },
            fixedAssets: { stats: fixedAssetStats, assets },
            vehicles: { stats: fleetStats, vehicles, payments, fuelDeposits },
            advancesAndIOUs: { stats: advanceStats, advances, ious },
            propertyRent: { stats: rentStats, propertyRents }
        };
    }
}
