import { AppError } from '@/lib/error';
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
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    if (!obj) return null;
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        current = (current as Record<string, unknown>)[part];
        if (current === undefined || current === null) return null;
    }
    return current;
}

// Helper to map operator string to Prisma conditions
function mapOperator(operator: string, value: string) {
    let parsedValue: string | number | boolean | Date = value;
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
function buildNestedFilter(parts: string[], operator: string, value: string): Record<string, unknown> {
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

    // contractorStock has no createdAt column; ordering by a missing field made that report fail
    private static orderField: Record<string, string> = { contractorStock: 'updatedAt' };

    private static prismaKeys: Record<string, string> = {
        serviceOrder: 'serviceOrder',
        materialUsage: 'sODMaterialUsage',
        contractorStock: 'contractorStock',
        journalEntry: 'journalEntry',
        wastage: 'contractorWastage'
    };

    /** Queryable fields per entity, used to tell the assistant what it may ask for. */
    static fieldsFor(entity: string): string[] | undefined {
        return this.whitelists[entity];
    }

    /**
     * `scopeWhere` is an extra server-built condition (for example the caller's OPMC scope) that is
     * AND-ed with the user's filters, so a custom report can never reach outside the caller's data.
     */
    static async generateReport(payload: DynamicReportPayload, opts: { scopeWhere?: Record<string, unknown> } = {}) {
        const { entity, columns, filters, aggregation } = payload;

        // 1. Validation
        if (!this.whitelists[entity]) {
            throw AppError.badRequest(`INVALID_ENTITY: Entity '${entity}' is not queryable.`);
        }

        const allowedFields = this.whitelists[entity];
        const invalidColumns = columns.filter(c => !allowedFields.includes(c));
        if (invalidColumns.length > 0) {
            throw AppError.badRequest(`INVALID_COLUMN: Columns [${invalidColumns.join(', ')}] are not permitted for entity '${entity}'.`);
        }

        // 2. Build Where Filter Object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const whereClause: Record<string, any> = {};
        for (const rule of filters) {
            if (!allowedFields.includes(rule.field)) {
                throw AppError.badRequest(`INVALID_FILTER: Filter on field '${rule.field}' is not permitted.`);
            }
            const parts = rule.field.split('.');
            // Status/type columns are enums (UPPER_CASE values) and reject text operators such as `contains`,
            // so "status contains pending" is treated as "status equals PENDING".
            const enumLike = /(^|\.)(status|sltsStatus|usageType|referenceType)$/i.test(rule.field);
            const operator = enumLike && (rule.operator === 'contains' || rule.operator === 'startsWith') ? 'equals' : rule.operator;
            const value = enumLike ? rule.value.trim().toUpperCase().replace(/\s+/g, '_') : rule.value;
            const filterObj = buildNestedFilter(parts, operator, value);
            
            // Merge filters
            const rootKey = parts[0];
            if (whereClause[rootKey]) {
                whereClause[rootKey] = { ...(whereClause[rootKey] as object), ...(filterObj[rootKey] as object) };
            } else {
                whereClause[rootKey] = filterObj[rootKey];
            }
        }

        // 3. Determine Includes based on entity
        let includeClause: Record<string, unknown> | undefined = undefined;
        if (entity === 'materialUsage') {
            includeClause = { serviceOrder: true, item: true };
        } else if (entity === 'contractorStock') {
            includeClause = { contractor: true, item: true };
        } else if (entity === 'wastage') {
            includeClause = { contractor: true, store: true };
        } else if (entity === 'serviceOrder') {
            // The standard service-order report only exposes scalar fields.
            // Loading the full OPMC relation for every row caused very slow
            // live queries and left the browser in its compiling state. Nested
            // relation columns are not whitelisted for this entity.
            includeClause = undefined;
        }

        // Aggregations over a flat column are computed by the database over ALL matching rows. The in-memory
        // path below only sees the newest 500 rows, which made counts such as "orders per status" wrong.
        if (aggregation && aggregation.groupBy && !aggregation.groupBy.includes('.') && !aggregation.targetField.includes('.')
            && allowedFields.includes(aggregation.groupBy) && allowedFields.includes(aggregation.targetField)) {
            const dbWhere = opts.scopeWhere ? { AND: [whereClause, opts.scopeWhere] } : whereClause;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dbClient = (prisma as any)[this.prismaKeys[entity]];
            const label = `${aggregation.type}_OF_${aggregation.targetField}`;
            try {
                const grouped = await dbClient.groupBy({
                    by: [aggregation.groupBy],
                    where: dbWhere,
                    ...(aggregation.type === 'COUNT' ? { _count: { _all: true } }
                        : aggregation.type === 'SUM' ? { _sum: { [aggregation.targetField]: true } }
                        : { _avg: { [aggregation.targetField]: true } }),
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rows = (grouped as any[]).map((g) => {
                    const raw = aggregation.type === 'COUNT' ? g._count._all : aggregation.type === 'SUM' ? g._sum[aggregation.targetField] : g._avg[aggregation.targetField];
                    return { [aggregation.groupBy]: g[aggregation.groupBy] === null || g[aggregation.groupBy] === undefined ? 'N/A' : String(g[aggregation.groupBy]), [label]: Number(Number(raw ?? 0).toFixed(2)) };
                }).sort((a, b) => Number(b[label]) - Number(a[label]));
                return { type: 'AGGREGATED', columns: [aggregation.groupBy, label], rows, capped: false };
            } catch {
                // SUM/AVG on a non-numeric column, or a column the database cannot group: use the bounded path below
            }
        }

        // 4. Fetch Raw Data from Master
        // We cast prisma client to any to call dynamic methods safely
        const prismaKey = this.prismaKeys[entity];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = (prisma as any)[prismaKey];
        const rawRecords = await client.findMany({
            where: opts.scopeWhere ? { AND: [whereClause, opts.scopeWhere] } : whereClause,
            include: includeClause,
            orderBy: { [this.orderField[entity] ?? 'createdAt']: 'desc' },
            // Keep interactive report generation bounded on production-sized
            // datasets. The UI is an operational report, not an unbounded
            // table export; CSV export can be extended with server pagination.
            take: 500,
        });

        // 5. Apply Aggregations if configured
        if (aggregation && aggregation.groupBy) {
            if (!allowedFields.includes(aggregation.groupBy) || !allowedFields.includes(aggregation.targetField)) {
                throw AppError.badRequest(`INVALID_AGGREGATION: Group by or target field is not queryable.`);
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                rows: aggregatedRows,
                capped: rawRecords.length >= 500
            };
        }

        // 6. Map and Flatten columns for standard tabular result
        const mappedRows = rawRecords.map((rec: Record<string, unknown>) => {
            const row: Record<string, unknown> = {};
            for (const col of columns) {
                row[col] = getNestedValue(rec, col);
            }
            return row;
        });

        return {
            type: 'STANDARD',
            columns,
            rows: mappedRows,
            // true when the 500-row limit cut the result, so the real number of matching rows is higher
            capped: rawRecords.length >= 500
        };
    }
}
