import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { slStartOfDayKey } from '@/lib/sl-time';

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
const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
function mapOperator(operator: string, value: string, caseInsensitiveEquals = false) {
    let parsedValue: string | number | boolean | Date = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value)) && value.trim() !== '') {
        parsedValue = Number(value);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        parsedValue = slStartOfDayKey(value); // a date means that Colombo day
    }

    // A date written without a time means the whole day, so "lte 2026-01-31" includes the 31st.
    if (parsedValue instanceof Date && !isNaN(parsedValue.getTime())) {
        const next = new Date(parsedValue.getTime() + DAY_MS);
        switch (operator) {
            case 'equals': return { gte: parsedValue, lt: next };
            case 'gt': return { gte: next };
            case 'gte': return { gte: parsedValue };
            case 'lt': return { lt: parsedValue };
            case 'lte': return { lt: next };
        }
    }
    switch (operator) {
        case 'equals': return caseInsensitiveEquals && typeof parsedValue === 'string' ? { equals: value, mode: 'insensitive' } : parsedValue;
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
        return { [parts[0]]: mapOperator(operator, value, /^(name|code|customerName)$/.test(parts[0])) };
    }
    const [current, ...rest] = parts;
    return {
        [current]: buildNestedFilter(rest, operator, value)
    };
}

// Recursive merge so two filters on one relation (item.name and item.code) both apply.
function mergeWhere(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) {
        const cur = out[k];
        const plain = (x: unknown) => !!x && typeof x === 'object' && !(x instanceof Date);
        out[k] = plain(cur) && plain(v) ? mergeWhere(cur as Record<string, unknown>, v as Record<string, unknown>) : v;
    }
    return out;
}

// ---------- joined aggregation in the database (parameterised SQL; identifiers come only from these maps) ----------

const NUMERIC_FIELDS = new Set(['quantity', 'costPrice', 'unitPrice', 'revenueAmount', 'contractorAmount']);
const DATE_FIELDS = new Set(['createdAt', 'updatedAt', 'completedDate', 'date', 'approvedAt']);
interface JoinDef { table: string; parent: string; fk: string }
interface SqlEntity { table: string; joins: Record<string, JoinDef>; scope?: { rel: string; column: string } }
const SQL_ENTITIES: Record<string, SqlEntity> = {
    serviceOrder: { table: 'ServiceOrder', joins: { contractor: { table: 'Contractor', parent: '', fk: 'contractorId' }, opmc: { table: 'OPMC', parent: '', fk: 'opmcId' } }, scope: { rel: '', column: 'opmcId' } },
    materialUsage: {
        table: 'SODMaterialUsage',
        joins: {
            serviceOrder: { table: 'ServiceOrder', parent: '', fk: 'serviceOrderId' }, item: { table: 'InventoryItem', parent: '', fk: 'itemId' },
            'serviceOrder.contractor': { table: 'Contractor', parent: 'serviceOrder', fk: 'contractorId' }, 'serviceOrder.opmc': { table: 'OPMC', parent: 'serviceOrder', fk: 'opmcId' },
        },
        scope: { rel: 'serviceOrder', column: 'opmcId' },
    },
    contractorStock: { table: 'ContractorStock', joins: { contractor: { table: 'Contractor', parent: '', fk: 'contractorId' }, item: { table: 'InventoryItem', parent: '', fk: 'itemId' } } },
    wastage: { table: 'ContractorWastage', joins: { contractor: { table: 'Contractor', parent: '', fk: 'contractorId' }, store: { table: 'InventoryStore', parent: '', fk: 'storeId' } } },
    journalEntry: { table: 'JournalEntry', joins: {} },
};
const aliasOf = (rel: string) => (rel ? `j_${rel.split('.').join('_')}` : 't');
const ident = (s: string) => `"${s.split('"').join('')}"`;

function sqlColumn(field: string): { expr: string; rel: string; kind: 'num' | 'date' | 'text' } {
    const parts = field.split('.');
    const col = parts[parts.length - 1];
    const rel = parts.slice(0, -1).join('.');
    return { expr: `${aliasOf(rel)}.${ident(col)}`, rel, kind: NUMERIC_FIELDS.has(col) ? 'num' : DATE_FIELDS.has(col) ? 'date' : 'text' };
}

function sqlJoins(entity: string, rels: Iterable<string>): string {
    const def = SQL_ENTITIES[entity];
    const needed = new Set<string>();
    for (const rel of rels) {
        if (!rel) continue;
        const chain = rel.split('.');
        for (let i = 1; i <= chain.length; i++) needed.add(chain.slice(0, i).join('.'));
    }
    return [...needed].sort((a, b) => a.split('.').length - b.split('.').length).map((rel) => {
        const j = def.joins[rel];
        if (!j) throw AppError.badRequest(`INVALID_COLUMN: '${rel}' cannot be joined for entity '${entity}'.`);
        return `LEFT JOIN ${ident(j.table)} ${aliasOf(rel)} ON ${aliasOf(rel)}."id" = ${aliasOf(j.parent)}.${ident(j.fk)}`;
    }).join(' ');
}

const REPORT_TIMEOUT_MS = 15_000;
/** Rows a report returns by default, and the hard ceiling for an explicit export request. */
export const DEFAULT_MAX_ROWS = 500;
export const ABSOLUTE_MAX_ROWS = 10_000;
const escapeLike = (x: string) => x.replace(/[\\%_]/g, (c) => '\\' + c);

function sqlCondition(rule: FilterRule, params: unknown[]): { sql: string; rel: string } {
    const { expr, rel, kind } = sqlColumn(rule.field);
    const p = (v: unknown, cast = '') => { params.push(v); return `$${params.length}${cast}`; };
    const v = rule.value.trim();
    const op = ({ gt: '>', lt: '<', gte: '>=', lte: '<=' } as Record<string, string>)[rule.operator];
    if (kind === 'num' && rule.operator !== 'contains' && rule.operator !== 'startsWith') {
        if (v === '' || isNaN(Number(v))) throw AppError.badRequest(`INVALID_FILTER: '${rule.field}' needs a number, got '${rule.value}'.`);
        return { sql: `${expr} ${op ?? '='} ${p(Number(v), '::numeric')}`, rel };
    }
    if (kind === 'date' && DATE_ONLY.test(v)) {
        const d = `(${p(v, '::timestamp')} - interval '5 hours 30 minutes')`;
        switch (rule.operator) {
            case 'gt': return { sql: `${expr} >= ${d} + interval '1 day'`, rel };
            case 'gte': return { sql: `${expr} >= ${d}`, rel };
            case 'lt': return { sql: `${expr} < ${d}`, rel };
            case 'lte': return { sql: `${expr} < ${d} + interval '1 day'`, rel };
            default: return { sql: `(${expr} >= ${d} AND ${expr} < ${d} + interval '1 day')`, rel };
        }
    }
    if (rule.operator === 'contains') return { sql: `${expr}::text ILIKE ${p(`%${escapeLike(v)}%`)}`, rel };
    if (rule.operator === 'startsWith') return { sql: `${expr}::text ILIKE ${p(`${escapeLike(v)}%`)}`, rel };
    if (op) return { sql: `${expr}::text ${op} ${p(v)}`, rel };
    return { sql: /(^|\.)(name|code|customerName)$/.test(rule.field) ? `${expr}::text ILIKE ${p(escapeLike(v))}` : `${expr}::text = ${p(v)}`, rel };
}

/** Builds the nested Prisma include for exactly the relations a row report needs. */
function buildInclude(paths: string[]): Record<string, unknown> | undefined {
    type Tree = { [k: string]: Tree };
    const root: Tree = {};
    for (const path of paths) {
        const rels = path.split('.').slice(0, -1);
        let node = root;
        for (const r of rels) node = node[r] ??= {};
    }
    const toInclude = (t: Tree): Record<string, unknown> => Object.fromEntries(Object.entries(t).map(([k, child]) => [k, Object.keys(child).length ? { include: toInclude(child) } : true]));
    return Object.keys(root).length ? toInclude(root) : undefined;
}

export class DynamicReportService {
    // Whitelist of allowed entities and their queryable fields
    private static whitelists: Record<string, string[]> = {
        serviceOrder: ['id', 'soNum', 'status', 'sltsStatus', 'customerName', 'voiceNumber', 'rtom', 'completedDate', 'revenueAmount', 'createdAt', 'contractor.name', 'contractor.status', 'opmc.name', 'opmc.rtom', 'opmc.region', 'opmc.province'],
        materialUsage: ['id', 'serviceOrderId', 'itemId', 'quantity', 'unit', 'usageType', 'costPrice', 'unitPrice', 'createdAt', 'serviceOrder.soNum', 'serviceOrder.status', 'serviceOrder.sltsStatus', 'serviceOrder.rtom', 'serviceOrder.completedDate', 'serviceOrder.contractor.name', 'serviceOrder.opmc.name', 'serviceOrder.opmc.region', 'item.code', 'item.name', 'item.category', 'item.type'],
        contractorStock: ['id', 'contractorId', 'itemId', 'quantity', 'updatedAt', 'contractor.name', 'contractor.status', 'item.code', 'item.name', 'item.category'],
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

    /**
     * GROUP BY across joined tables, executed by the database over every matching row (not a 500-row sample).
     * Values travel as bound parameters; column and table names come only from the whitelist maps above.
     */
    private static async joinedAggregate(entity: string, filters: FilterRule[], agg: AggregationConfig, opmcIds?: readonly string[], maxRows = DEFAULT_MAX_ROWS) {
        const def = SQL_ENTITIES[entity];
        if (!def) throw AppError.badRequest(`INVALID_ENTITY: Entity '${entity}' is not queryable.`);
        const params: unknown[] = [];
        const rels = new Set<string>();
        const conditions: string[] = [];
        for (const rule of filters) { const c = sqlCondition(rule, params); conditions.push(c.sql); rels.add(c.rel); }
        if (opmcIds !== undefined) {
            if (!def.scope) throw AppError.badRequest(`INVALID_ENTITY: '${entity}' cannot be limited to an OPMC.`);
            params.push([...opmcIds]);
            conditions.push(`${aliasOf(def.scope.rel)}.${ident(def.scope.column)} = ANY($${params.length}::uuid[])`);
            rels.add(def.scope.rel);
        }
        const group = sqlColumn(agg.groupBy);
        rels.add(group.rel);
        let value = 'COUNT(*)';
        if (agg.type !== 'COUNT') {
            const target = sqlColumn(agg.targetField);
            if (target.kind !== 'num') throw AppError.badRequest(`INVALID_AGGREGATION: ${agg.type} needs a numeric field, '${agg.targetField}' is not numeric.`);
            rels.add(target.rel);
            value = `${agg.type}(${target.expr})`;
        }
        const label = `${agg.type}_OF_${agg.targetField.split('.').join('_')}`;
        const from = `FROM ${ident(def.table)} t ${sqlJoins(entity, rels)}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`;
        const targetExpr = agg.type === 'COUNT' ? '1' : sqlColumn(agg.targetField).expr;
        // s and c let every group be re-derived (AVG = s / c) and every total be reconciled
        const sql = `SELECT ${group.expr}::text AS k, ${value} AS v, COALESCE(SUM(${targetExpr}), 0) AS s, COUNT(*) AS c, COUNT(${targetExpr}) AS cn ${from} GROUP BY 1 ORDER BY 2 DESC NULLS LAST, 1 LIMIT ${maxRows + 1}`;
        // One read-only transaction with a hard time limit: a heavy question can never lock or slow the live system,
        // and both the groups and the control total are read from the same snapshot.
        const { found, total } = await prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
            await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${REPORT_TIMEOUT_MS}`);
            const found = await tx.$queryRawUnsafe<Array<{ k: string | null; v: unknown; s: unknown; c: unknown; cn: unknown }>>(sql, ...params);
            const [total] = await tx.$queryRawUnsafe<Array<{ s: unknown; c: unknown }>>(`SELECT COALESCE(SUM(${targetExpr}), 0) AS s, COUNT(*) AS c ${from}`, ...params);
            return { found, total };
        }, { timeout: REPORT_TIMEOUT_MS + 5000, isolationLevel: 'RepeatableRead' }).catch((e: unknown) => {
            if (/statement timeout|canceling statement/i.test(String(e instanceof Error ? e.message : e))) {
                throw AppError.badRequest('INVALID_AGGREGATION: this question is too heavy to answer live; add a filter (a date range or an RTOM) and ask again.');
            }
            throw e;
        });
        const capped = found.length > maxRows;
        const shown = found.slice(0, maxRows);
        const rows = shown.map((r) => ({ [agg.groupBy]: r.k === null ? 'N/A' : r.k, [label]: Number(Number(r.v ?? 0).toFixed(2)) }));

        // Reconciliation: an independent query over the same rows must equal the sum of the groups, and each AVG must equal sum/count.
        let verified = false;
        if (!capped) {
            const groupSum = shown.reduce((a, r) => a + Number(r.s ?? 0), 0);
            const groupCount = shown.reduce((a, r) => a + Number(r.c ?? 0), 0);
            const tol = 0.01 * Math.max(1, shown.length);
            if (Number(total.c) !== groupCount || Math.abs(Number(total.s) - groupSum) > tol) {
                throw AppError.badRequest(`INVALID_AGGREGATION: the groups do not add up to the total (rows ${groupCount} vs ${Number(total.c)}); the report was withheld.`);
            }
            if (agg.type === 'AVG' && shown.some((r) => Number(r.cn) > 0 && Math.abs(Number(r.s) / Number(r.cn) - Number(r.v)) > 0.01)) {
                throw AppError.badRequest('INVALID_AGGREGATION: an average does not match its sum and count; the report was withheld.');
            }
            verified = true;
        }
        return { type: 'AGGREGATED' as const, columns: [agg.groupBy, label], rows, capped, verified };
    }

    /** Queryable fields per entity, used to tell the assistant what it may ask for. */
    static fieldsFor(entity: string): string[] | undefined {
        return this.whitelists[entity];
    }

    /**
     * `scopeWhere` is an extra server-built condition (for example the caller's OPMC scope) that is
     * AND-ed with the user's filters, so a custom report can never reach outside the caller's data.
     */
    static async generateReport(payload: DynamicReportPayload, opts: { scopeWhere?: Record<string, unknown>; opmcIds?: readonly string[]; maxRows?: number } = {}) {
        const { entity, columns, filters, aggregation } = payload;
        const maxRows = Math.min(Math.max(Math.floor(opts.maxRows ?? DEFAULT_MAX_ROWS), 1), ABSOLUTE_MAX_ROWS);

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
            
            // Merge filters (recursively, so item.name and item.code both survive)
            Object.assign(whereClause, mergeWhere(whereClause, filterObj));
        }

        // 3. Load only the relations the report actually uses (no full-row joins for plain service order lists)
        const includeClause = buildInclude([...columns, ...filters.map((f) => f.field), ...(aggregation ? [aggregation.groupBy, aggregation.targetField] : [])]);

        // Every aggregation (single table or joined) is computed by the database over ALL matching rows. There is
        // deliberately no in-memory fallback: a sampled total would look right and be wrong.
        if (aggregation && aggregation.groupBy) {
            if (!allowedFields.includes(aggregation.groupBy) || !allowedFields.includes(aggregation.targetField)) {
                throw AppError.badRequest(`INVALID_AGGREGATION: Group by or target field is not queryable.`);
            }
            if (opts.scopeWhere && opts.opmcIds === undefined) throw AppError.badRequest('INVALID_AGGREGATION: a scoped aggregation needs the OPMC list.');
            return this.joinedAggregate(entity, filters.map((rule) => {
                const enumLike = /(^|\.)(status|sltsStatus|usageType|referenceType)$/i.test(rule.field);
                return enumLike ? { ...rule, operator: (rule.operator === 'contains' || rule.operator === 'startsWith' ? 'equals' : rule.operator) as FilterRule['operator'], value: rule.value.trim().toUpperCase().replace(/\s+/g, '_') } : rule;
            }), aggregation, opts.opmcIds, maxRows);
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
            // Always bounded (default 500, hard ceiling ABSOLUTE_MAX_ROWS) so a report can never exhaust the server.
            take: maxRows,
        });

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
            // true when the row limit cut the result, so the real number of matching rows is higher
            capped: rawRecords.length >= maxRows
        };
    }
}

/** Pure helpers exposed for unit tests. */
export const __joinInternals = { sqlCondition, sqlJoins, buildInclude, mapOperator, mergeWhere };
