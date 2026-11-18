import { Prisma } from '@prisma/client';
import { RBAC_PERMISSIONS as P } from '@/config/rbac-permissions';

/**
 * The tables the report engine and the assistant may read, beyond the five original entities.
 *
 * Security first: nothing is exposed unless it is listed here. Each entity names the capability that opens it,
 * the exact fields (and many-to-one relations) that may be read, which of those need an extra capability, and the
 * path to its OPMC (so a user limited to some areas never sees other areas). A table with no `scopePath` is
 * company-wide only and is refused for users limited to specific OPMCs.
 *
 * The mechanics (database table and column names, how to join, which fields are numbers, dates or enums) are
 * read from the Prisma schema itself, so they can never drift from the real database.
 */
export interface ExtraEntity {
    id: string;
    model: string;
    label: string;
    description: string;
    synonyms: string[];
    permission: string;
    /** Field paths that may be read: a column of the table, or `relation.column` (many-to-one, up to three levels). */
    fields: string[];
    /** Fields that need an additional capability on top of the entity capability. */
    restricted?: Record<string, string>;
    /** Path from a row to the OPMC id, e.g. `opmcId` or `project.opmcId`. */
    scopePath?: string;
    /** Business-friendly names for fields, shown in tables and the builder. */
    labels?: Record<string, string>;
}

export const EXTRA_ENTITIES: ExtraEntity[] = [
    {
        id: 'project', model: 'Project', label: 'Projects', description: 'Projects with their status, progress, dates, area and contractor',
        synonyms: ['project', 'projects', 'wada', 'ව්‍යාපෘති', 'vyapruthi'], permission: P.PROJECT_READ, scopePath: 'opmcId',
        fields: ['projectCode', 'name', 'type', 'location', 'status', 'progress', 'startDate', 'endDate', 'poNumber', 'createdAt', 'budget', 'contractValue', 'actualCost', 'variance', 'opmc.name', 'opmc.rtom', 'opmc.region', 'contractor.name'],
        restricted: { budget: P.PROJECT_FINANCE_READ, contractValue: P.PROJECT_FINANCE_READ, actualCost: P.PROJECT_FINANCE_READ, variance: P.PROJECT_FINANCE_READ },
        labels: { projectCode: 'Project code', poNumber: 'PO number', 'opmc.rtom': 'RTOM' },
    },
    {
        id: 'projectTask', model: 'ProjectTask', label: 'Project tasks', description: 'Tasks inside projects: status, priority, progress, due dates and who they are assigned to',
        synonyms: ['task', 'tasks', 'project task', 'work item', 'wada bedeema'], permission: P.PROJECT_READ, scopePath: 'project.opmcId',
        fields: ['wbsCode', 'name', 'type', 'status', 'priority', 'plannedStartDate', 'plannedEndDate', 'actualStartDate', 'actualEndDate', 'plannedProgress', 'actualProgress', 'isCritical', 'estimatedCost', 'actualCost', 'createdAt', 'project.projectCode', 'project.name', 'project.status', 'project.opmc.name', 'contractor.name', 'assignedUser.name'],
        restricted: { estimatedCost: P.PROJECT_FINANCE_READ, actualCost: P.PROJECT_FINANCE_READ },
        labels: { wbsCode: 'WBS code', 'assignedUser.name': 'Assigned to', isCritical: 'Critical path' },
    },
    {
        id: 'contractor', model: 'Contractor', label: 'Contractors', description: 'Registered contractors with type, status, agreement and area',
        synonyms: ['contractor', 'contractors', 'gutthakaru', 'ගුත්තකරු'], permission: P.CONTRACTOR_READ, scopePath: 'opmcId',
        fields: ['name', 'type', 'status', 'registrationNumber', 'agreementSigned', 'agreementDate', 'kycVerified', 'documentStatus', 'createdAt', 'opmc.name', 'opmc.rtom', 'opmc.region'],
        labels: { kycVerified: 'KYC verified', 'opmc.rtom': 'RTOM' },
    },
    {
        id: 'contractorInvoice', model: 'Invoice', label: 'Contractor invoices', description: 'Invoices raised for contractors: amounts, status, approval and payment',
        synonyms: ['invoice', 'invoices', 'contractor invoice', 'bills', 'invoice eka'], permission: P.FINANCE_READ, scopePath: 'contractor.opmcId',
        fields: ['invoiceNumber', 'status', 'approvalStatus', 'year', 'month', 'amount', 'totalAmount', 'amountA', 'statusA', 'amountB', 'statusB', 'retentionAmount', 'vatAmount', 'whtAmount', 'date', 'dueDate', 'createdAt', 'rtomArea', 'contractor.name', 'project.projectCode'],
        labels: { rtomArea: 'RTOM area', amountA: 'Amount A', amountB: 'Amount B', statusA: 'Status A', statusB: 'Status B', whtAmount: 'WHT amount', vatAmount: 'VAT amount' },
    },
    {
        id: 'supplierInvoice', model: 'SupplierInvoice', label: 'Supplier invoices', description: 'Invoices received from suppliers: amounts, matching, approval and payment',
        synonyms: ['supplier invoice', 'vendor invoice', 'supplier bills', 'payables'], permission: P.FINANCE_READ, scopePath: 'opmcId',
        fields: ['invoiceNumber', 'invoiceDate', 'dueDate', 'status', 'matchStatus', 'category', 'currency', 'subtotal', 'taxAmount', 'totalAmount', 'paidAmount', 'paidAt', 'approvedAt', 'periodMonth', 'createdAt', 'vendor.name'],
        labels: { 'vendor.name': 'Supplier' },
    },
    {
        id: 'purchaseOrder', model: 'PurchaseOrder', label: 'Purchase orders', description: 'Store purchase orders: supplier, status, dates and amounts',
        synonyms: ['purchase order', 'purchase orders', 'po', 'pos', 'procurement orders'], permission: P.PROCUREMENT_READ,
        fields: ['poNumber', 'vendor', 'status', 'currency', 'orderDate', 'expectedDelivery', 'subtotal', 'taxAmount', 'totalAmount', 'approvedAt', 'closedAt', 'cancelledAt', 'createdAt'],
        labels: { poNumber: 'PO number', vendor: 'Supplier' },
    },
    {
        id: 'grn', model: 'GRN', label: 'Goods received notes', description: 'Goods received into stores: supplier, store and purchase order',
        synonyms: ['grn', 'grns', 'goods received', 'goods receipt', 'received goods'], permission: P.PROCUREMENT_READ,
        fields: ['grnNumber', 'sourceType', 'supplier', 'reference', 'createdAt', 'store.name', 'purchaseOrder.poNumber', 'purchaseOrder.status'],
        labels: { grnNumber: 'GRN number', 'purchaseOrder.poNumber': 'PO number', 'purchaseOrder.status': 'PO status' },
    },
    {
        id: 'inventoryItem', model: 'InventoryItem', label: 'Inventory items', description: 'The material catalogue: code, name, category, unit and cost',
        synonyms: ['item', 'items', 'material', 'materials', 'catalogue', 'inventory items'], permission: P.INVENTORY_READ,
        fields: ['code', 'name', 'category', 'type', 'unit', 'source', 'minLevel', 'hasSerial', 'unitPrice', 'costPrice', 'createdAt'],
        restricted: { unitPrice: P.INVENTORY_COST_READ, costPrice: P.INVENTORY_COST_READ },
    },
    {
        id: 'inventoryStock', model: 'InventoryStock', label: 'Store stock', description: 'Stock quantity of each item in each store',
        synonyms: ['store stock', 'stock', 'stock level', 'stock in stores', 'thoguwa', 'තොග'], permission: P.INVENTORY_READ,
        fields: ['quantity', 'allocatedQuantity', 'minLevel', 'updatedAt', 'store.name', 'store.type', 'item.code', 'item.name', 'item.category', 'item.unit'],
    },
    {
        id: 'ticket', model: 'Ticket', label: 'Helpdesk tickets', description: 'IT helpdesk tickets: category, priority, status and SLA',
        synonyms: ['ticket', 'tickets', 'helpdesk', 'support ticket', 'issue'], permission: P.HELPDESK_READ,
        fields: ['ticketNumber', 'category', 'priority', 'status', 'createdAt', 'firstResponseAt', 'resolvedAt', 'slaResponseBreached', 'slaResolutionBreached', 'satisfactionRating', 'assignedTo.name'],
        labels: { 'assignedTo.name': 'Assigned to', slaResponseBreached: 'Response SLA breached', slaResolutionBreached: 'Resolution SLA breached' },
    },
];

// ---------- mechanics read from the Prisma schema ----------

export type FieldKind = 'num' | 'date' | 'text' | 'enum';
export interface JoinDef { table: string; parent: string; fk: string }
export interface ResolvedEntity {
    id: string;
    table: string;
    prismaKey: string;
    orderField: string;
    whitelist: string[];
    joins: Record<string, JoinDef>;
    kinds: Record<string, FieldKind>;
    enums: Record<string, string[]>;
    scope?: { rel: string; column: string };
    /** Prisma `where` that limits rows to the given OPMC ids, or undefined when the entity cannot be scoped. */
    scopeWhere: (opmcIds: readonly string[]) => Record<string, unknown> | undefined;
}

const MODELS = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
const ENUMS = new Map(Prisma.dmmf.datamodel.enums.map((e) => [e.name, e.values.map((v) => v.name)]));
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function resolve(entity: ExtraEntity, problems: string[]): ResolvedEntity | undefined {
    const root = MODELS.get(entity.model);
    if (!root) { problems.push(`${entity.id}: model ${entity.model} does not exist`); return undefined; }
    const joins: Record<string, JoinDef> = {};
    const kinds: Record<string, FieldKind> = {};
    const enums: Record<string, string[]> = {};
    const whitelist: string[] = ['id'];

    // Walks "a.b.c" through many-to-one relations; registers the joins on the way and returns the final column.
    const walk = (path: string): { kind: FieldKind; type: string } | undefined => {
        const parts = path.split('.');
        let model = root;
        for (let i = 0; i < parts.length; i++) {
            const f = model.fields.find((x) => x.name === parts[i]);
            if (!f) { problems.push(`${entity.id}: ${path} (no field ${parts[i]} on ${model.name})`); return undefined; }
            const last = i === parts.length - 1;
            if (!last) {
                if (f.kind !== 'object' || f.isList || !f.relationFromFields?.length) { problems.push(`${entity.id}: ${path} (${f.name} is not a many-to-one relation)`); return undefined; }
                const target = MODELS.get(f.type);
                if (!target) { problems.push(`${entity.id}: ${path} (unknown model ${f.type})`); return undefined; }
                const rel = parts.slice(0, i + 1).join('.');
                const fkField = model.fields.find((x) => x.name === f.relationFromFields![0]);
                joins[rel] = { table: target.dbName ?? target.name, parent: parts.slice(0, i).join('.'), fk: fkField?.dbName ?? f.relationFromFields[0] };
                model = target;
                continue;
            }
            if (f.kind === 'object') { problems.push(`${entity.id}: ${path} is a relation, not a column`); return undefined; }
            if (f.isList) { problems.push(`${entity.id}: ${path} is a list`); return undefined; }
            const kind: FieldKind = f.kind === 'enum' ? 'enum' : (f.type === 'Decimal' || f.type === 'Int' || f.type === 'Float' || f.type === 'BigInt') ? 'num' : f.type === 'DateTime' ? 'date' : 'text';
            if (f.kind === 'enum') enums[path] = ENUMS.get(f.type) ?? [];
            return { kind, type: f.type };
        }
        return undefined;
    };

    for (const path of entity.fields) {
        const r = walk(path);
        if (!r) continue;
        whitelist.push(path);
        kinds[path] = r.kind;
    }
    const idKind = walk('id');
    if (idKind) kinds.id = 'text';

    let scope: ResolvedEntity['scope'];
    let scopeWhere: ResolvedEntity['scopeWhere'] = () => undefined;
    if (entity.scopePath) {
        const parts = entity.scopePath.split('.');
        const column = parts[parts.length - 1];
        const rel = parts.slice(0, -1).join('.');
        if (walk(entity.scopePath) && (!rel || joins[rel])) {
            scope = { rel, column };
            scopeWhere = (ids) => parts.reduceRight<Record<string, unknown> | undefined>((inner, part, i) => (i === parts.length - 1 ? { [part]: { in: [...ids] } } : { [part]: inner }), undefined);
        } else problems.push(`${entity.id}: scope path ${entity.scopePath} is not valid`);
    }
    for (const field of Object.keys(entity.restricted ?? {})) if (!whitelist.includes(field)) problems.push(`${entity.id}: restricted field ${field} is not in fields`);

    const hasCreated = root.fields.some((f) => f.name === 'createdAt');
    const hasUpdated = root.fields.some((f) => f.name === 'updatedAt');
    return {
        id: entity.id,
        table: root.dbName ?? root.name,
        prismaKey: lowerFirst(root.name),
        orderField: hasCreated ? 'createdAt' : hasUpdated ? 'updatedAt' : 'id',
        whitelist, joins, kinds, enums, scope, scopeWhere,
    };
}

const problems: string[] = [];
export const RESOLVED_ENTITIES: Record<string, ResolvedEntity> = {};
for (const e of EXTRA_ENTITIES) {
    const r = resolve(e, problems);
    if (r) RESOLVED_ENTITIES[e.id] = r;
}
// A renamed column must never take the application down: the broken entry is skipped and logged, and the unit test fails.
if (problems.length) console.error('[REPORTS] Entity registry problems:', problems.join(' | '));
export const ENTITY_REGISTRY_PROBLEMS: readonly string[] = problems;

export const EXTRA_ENTITY_BY_ID: Record<string, ExtraEntity> = Object.fromEntries(EXTRA_ENTITIES.filter((e) => RESOLVED_ENTITIES[e.id]).map((e) => [e.id, e]));

/** The capability a field needs on top of the entity capability, if any. */
export function restrictedCapability(entity: string, path: string): string | undefined {
    return EXTRA_ENTITY_BY_ID[entity]?.restricted?.[path];
}
