import { prisma } from '@/lib/prisma';

export interface FilterRule {
    field: string;
    operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'startsWith';
    value: string;
}

export interface AggregationConfig {
    groupBy: string;
    targetField: string;
    type: 'SUM' | 'AVG' | 'COUNT';
}

export interface DynamicReportPayload {
    entity: 'serviceOrder' | 'materialUsage' | 'contractorStock' | 'journalEntry' | 'wastage';
    columns: string[];
    filters: FilterRule[];
    aggregation?: AggregationConfig;
}

// Helper to access nested objects via string path (e.g. "serviceOrder.soNum")
function getNestedValue(obj: any, path: string): any {
    if (!obj) return null;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        current = current[part];
        if (current === undefined || current === null) return null;
    }
    return current;
}

// Helper to map operator string to Prisma conditions
function mapOperator(operator: string, value: string) {
    let parsedValue: any = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value)) && value.trim() !== '') {
        parsedValue = Number(value);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        parsedValue = new Date(value);
    }

    switch (operator) {
        case 'equals': return parsedValue;
        case 'contains': return { contains: value, mode: 'insensitive' };
        case 'startsWith': return { startsWith: value, mode: 'insensitive' };
        case 'gt': return { gt: parsedValue };
        case 'lt': return { lt: parsedValue };
        case 'gte': return { gte: parsedValue };
        case 'lte': return { lte: parsedValue };
        default: return parsedValue;
    }
}

// Helper to recursively build nested prisma where objects
function buildNestedFilter(parts: string[], operator: string, value: string): any {
    if (parts.length === 1) {
        return { [parts[0]]: mapOperator(operator, value) };
    }
    const [current, ...rest] = parts;
    return {
        [current]: buildNestedFilter(rest, operator, value)
    };
}

export class DynamicReportService {
    // Whitelist of allowed entities and their queryable fields
    private static whitelists: Record<string, string[]> = {
        serviceOrder: ['id', 'soNum', 'status', 'sltsStatus', 'customerName', 'voiceNumber', 'rtom', 'completedDate', 'revenueAmount', 'createdAt'],
        materialUsage: ['id', 'serviceOrderId', 'itemId', 'quantity', 'unit', 'usageType', 'costPrice', 'unitPrice', 'createdAt', 'serviceOrder.soNum', 'serviceOrder.status', 'serviceOrder.sltsStatus', 'serviceOrder.rtom', 'item.code', 'item.name'],
        contractorStock: ['id', 'contractorId', 'itemId', 'quantity', 'updatedAt', 'contractor.name', 'item.code', 'item.name'],
        journalEntry: ['id', 'referenceId', 'referenceType', 'description', 'date', 'createdAt'],
        wastage: ['id', 'contractorId', 'storeId', 'month', 'description', 'status', 'approvedById', 'approvedAt', 'createdAt', 'contractor.name', 'store.name']
    };

    private static prismaKeys: Record<string, string> = {
        serviceOrder: 'serviceOrder',
        materialUsage: 'sODMaterialUsage',
        contractorStock: 'contractorStock',
        journalEntry: 'journalEntry',
        wastage: 'contractorWastage'
    };

    static async generateReport(payload: DynamicReportPayload) {
        const { entity, columns, filters, aggregation } = payload;

        // 1. Validation
        if (!this.whitelists[entity]) {
            throw new Error(`INVALID_ENTITY: Entity '${entity}' is not queryable.`);
        }

        const allowedFields = this.whitelists[entity];
        const invalidColumns = columns.filter(c => !allowedFields.includes(c));
        if (invalidColumns.length > 0) {
            throw new Error(`INVALID_COLUMN: Columns [${invalidColumns.join(', ')}] are not permitted for entity '${entity}'.`);
        }

        // 2. Build Where Filter Object
        const whereClause: Record<string, any> = {};
        for (const rule of filters) {
            if (!allowedFields.includes(rule.field)) {
                throw new Error(`INVALID_FILTER: Filter on field '${rule.field}' is not permitted.`);
            }
            const parts = rule.field.split('.');
            const filterObj = buildNestedFilter(parts, rule.operator, rule.value);
            
            // Merge filters
            const rootKey = parts[0];
            if (whereClause[rootKey]) {
                whereClause[rootKey] = { ...whereClause[rootKey], ...filterObj[rootKey] };
            } else {
                whereClause[rootKey] = filterObj[rootKey];
            }
        }

        // 3. Determine Includes based on entity
        let includeClause: any = undefined;
        if (entity === 'materialUsage') {
            includeClause = { serviceOrder: true, item: true };
        } else if (entity === 'contractorStock') {
            includeClause = { contractor: true, item: true };
        } else if (entity === 'wastage') {
            includeClause = { contractor: true, store: true };
        } else if (entity === 'serviceOrder') {
            includeClause = { opmc: true };
        }

        // 4. Fetch Raw Data from Master
        // We cast prisma client to any to call dynamic methods safely
        const prismaKey = this.prismaKeys[entity];
        const client = (prisma as any)[prismaKey];
        const rawRecords = await client.findMany({
            where: whereClause,
            include: includeClause,
            orderBy: { createdAt: 'desc' }
        });

        // 5. Apply Aggregations if configured
        if (aggregation && aggregation.groupBy) {
            if (!allowedFields.includes(aggregation.groupBy) || !allowedFields.includes(aggregation.targetField)) {
                throw new Error(`INVALID_AGGREGATION: Group by or target field is not queryable.`);
            }

            const groups: Record<string, any[]> = {};
            for (const rec of rawRecords) {
                const groupKey = String(getNestedValue(rec, aggregation.groupBy) || 'N/A');
                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(rec);
            }

            const aggregatedRows = Object.entries(groups).map(([groupVal, items]) => {
                let aggResult = 0;
                const targetValues = items.map(i => Number(getNestedValue(i, aggregation.targetField) || 0));

                if (aggregation.type === 'SUM') {
                    aggResult = targetValues.reduce((sum, v) => sum + v, 0);
                } else if (aggregation.type === 'AVG') {
                    aggResult = targetValues.length > 0 ? (targetValues.reduce((sum, v) => sum + v, 0) / targetValues.length) : 0;
                } else if (aggregation.type === 'COUNT') {
                    aggResult = targetValues.length;
                }

                return {
                    [aggregation.groupBy]: groupVal,
                    [`${aggregation.type}_OF_${aggregation.targetField.replace('.', '_')}`]: Number(aggResult.toFixed(2))
                };
            });

            // Return aggregated structure
            const aggCols = [aggregation.groupBy, `${aggregation.type}_OF_${aggregation.targetField.replace('.', '_')}`];
            return {
                type: 'AGGREGATED',
                columns: aggCols,
                rows: aggregatedRows
            };
        }

        // 6. Map and Flatten columns for standard tabular result
        const mappedRows = rawRecords.map((rec: any) => {
            const row: Record<string, any> = {};
            for (const col of columns) {
                row[col] = getNestedValue(rec, col);
            }
            return row;
        });

        return {
            type: 'STANDARD',
            columns,
            rows: mappedRows
        };
    }
}
