import { prisma } from '@/lib/prisma';
import { StockService } from './stock.service';
import { ProjectPurchaseOrderService } from '../project-purchase-order.service';

export class ForecastService {
    /**
     * Generate an AI-based material shortage forecast using consumption history and targets
     */
    static async getMaterialForecast(options: {
        months: number;
        monthlyConnectionTarget: number;
    }) {
        const months = options.months || 1;
        const target = options.monthlyConnectionTarget || 0;

        // 1. Calculate Average Monthly Consumption (based on past 3 months of issue transactions)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const consumptionItems = await prisma.inventoryTransactionItem.findMany({
            where: {
                quantity: { lt: 0 },
                transaction: {
                    date: { gte: threeMonthsAgo },
                    type: { in: ['TRANSFER_OUT', 'WASTAGE'] },
                    NOT: [
                        { notes: { contains: 'Released to Transit' } },
                        { notes: { contains: 'Material Issue' } },
                        { notes: { contains: 'Transit incoming' } }
                    ]
                }
            },
            select: {
                itemId: true,
                quantity: true
            }
        });

        const consumptionMap: Record<string, number> = {};
        for (const item of consumptionItems) {
            const qty = Math.abs(Number(item.quantity));
            consumptionMap[item.itemId] = (consumptionMap[item.itemId] || 0) + qty;
        }

        // 2. Fetch Material Standards
        const standards = await prisma.materialStandard.findMany();

        // 3. Fetch Items and Stock levels
        const items = await prisma.inventoryItem.findMany({
            where: { type: 'SLTS' }
        });

        const stocks = await prisma.inventoryStock.groupBy({
            by: ['itemId'],
            _sum: { quantity: true }
        });

        const stockMap: Record<string, number> = {};
        for (const s of stocks) {
            stockMap[s.itemId] = s._sum.quantity ? Number(s._sum.quantity) : 0;
        }

        const forecastReport = [];

        for (const item of items) {
            const currentStock = stockMap[item.id] || 0;

            // Monthly consumption average
            const totalThreeMonthConsumed = consumptionMap[item.id] || 0;
            const avgMonthlyConsumption = StockService.round(totalThreeMonthConsumed / 3);

            // Target-based monthly demand
            const standard = standards.find(s => s.itemId === item.id);
            const standardQty = standard?.standardQty ? Number(standard.standardQty) : 0;
            const targetMonthlyDemand = target * standardQty;

            // Total predicted demand for N months
            const monthlyDemand = avgMonthlyConsumption + targetMonthlyDemand;
            const predictedDemand = StockService.round(monthlyDemand * months);

            // Calculate shortage and recommended order
            const shortfall = Math.max(0, predictedDemand - currentStock);
            const recommendedQty = Math.ceil(shortfall * 1.1); // 10% buffer
            const costPrice = item.costPrice ? Number(item.costPrice) : (item.unitPrice ? Number(item.unitPrice) : 0);
            const projectedCost = recommendedQty * costPrice;

            forecastReport.push({
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                unit: item.unit,
                currentStock,
                avgMonthlyConsumption,
                targetMonthlyDemand,
                predictedDemand,
                shortfall,
                recommendedQty,
                unitPrice: costPrice,
                projectedCost,
                isLowStock: currentStock <= Number(item.minLevel)
            });
        }

        return forecastReport.filter(r => r.shortfall > 0 || r.isLowStock);
    }

    /**
     * Generate a Draft PO based on forecast recommendations
     */
    static async generateDraftPO(options: {
        projectId: string;
        vendorId: string;
        title: string;
        items: Array<{ itemCode: string; description: string; unit: string; quantity: number; unitPrice: number }>;
    }) {
        const vendor = await prisma.vendor.findUnique({
            where: { id: options.vendorId }
        });
        if (!vendor) throw new Error("VENDOR_NOT_FOUND");

        const po = await ProjectPurchaseOrderService.createPurchaseOrder({
            projectId: options.projectId,
            vendorId: options.vendorId,
            vendorName: vendor.name,
            title: options.title,
            priority: 'MEDIUM',
            type: 'MATERIAL',
            items: options.items.map(item => ({
                itemCode: item.itemCode,
                description: item.description,
                unit: item.unit,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                notes: 'Generated by AI prediction forecast'
            }))
        });

        return po;
    }
}
