import { prisma } from '@/lib/prisma';

export interface AbcClassificationItem {
    itemId: string;
    itemCode: string;
    itemName: string;
    category: string;
    unitPrice: number;
    annualQty: number;
    annualValue: number;
    cumulativeValue: number;
    cumulativePercent: number;
    abcClass: 'A' | 'B' | 'C';
    recommendation: string;
}

export class AbcService {
    /**
     * Generate an ABC classification analysis report based on consumption value.
     */
    static async generateAbcReport(): Promise<AbcClassificationItem[]> {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // 1. Fetch all items with cost details
        const items = await prisma.inventoryItem.findMany({
            select: { id: true, code: true, name: true, category: true, costPrice: true, unitPrice: true }
        });

        // 2. Fetch past 90 days consumption quantities
        const usages = await prisma.sODMaterialUsage.groupBy({
            by: ['itemId'],
            where: { createdAt: { gte: ninetyDaysAgo } },
            _sum: { quantity: true }
        });

        // 3. Map annual consumption values
        let totalAnnualValue = 0;
        const mappedItems = items.map(item => {
            const usage = usages.find(u => u.itemId === item.id);
            const qty90Days = usage?._sum?.quantity || 0;
            
            // Scale 90-day consumption to annual (365 days)
            const annualQty = Math.round((qty90Days * (365 / 90)) * 100) / 100;
            
            const price = Number(item.costPrice || item.unitPrice || 0);
            const annualValue = Math.round((annualQty * price) * 100) / 100;

            totalAnnualValue += annualValue;

            return {
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                category: item.category,
                unitPrice: price,
                annualQty,
                annualValue
            };
        });

        // 4. Sort descending by annual consumption value
        mappedItems.sort((a, b) => b.annualValue - a.annualValue);

        // 5. Calculate cumulative percentages and assign ABC classes
        let runningValueSum = 0;
        const abcReport: AbcClassificationItem[] = [];

        for (const item of mappedItems) {
            runningValueSum += item.annualValue;
            const cumulativePercent = totalAnnualValue > 0 
                ? (runningValueSum / totalAnnualValue) * 100 
                : 100;

            let abcClass: 'A' | 'B' | 'C' = 'C';
            let recommendation = 'Low priority. Review inventory quarterly. Maintain bulk safety stocks.';

            if (cumulativePercent <= 80) {
                abcClass = 'A';
                recommendation = 'CRITICAL. Implement daily cycle counting. Tight security. Enforce strict authorization limits.';
            } else if (cumulativePercent <= 95) {
                abcClass = 'B';
                recommendation = 'Medium priority. Perform monthly counts. Maintain moderate safety stock.';
            }

            abcReport.push({
                ...item,
                cumulativeValue: Math.round(runningValueSum * 100) / 100,
                cumulativePercent: Math.round(cumulativePercent * 100) / 100,
                abcClass,
                recommendation
            });
        }

        return abcReport;
    }
}
