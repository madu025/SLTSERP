import {
    InventoryStore,
    InventoryBatch,
    User
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type { UUID } from '@/types/common';

export type InventoryItemContext = 'OSP_FTTH' | 'GENERAL' | string;

// Type for the extended Prisma transaction client
export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface CreateItemData {
    code: string;
    name: string;
    description?: string;
    unit?: string;
    type?: string;
    category?: string;
    commonFor?: string[];
    minLevel?: string | number;
    unitPrice?: string | number;
    costPrice?: string | number;
    isWastageAllowed?: boolean;
    maxWastagePercentage?: string | number;
    isOspFtth?: boolean;
    hasSerial?: boolean;
    commonName?: string;
    sltCode?: string;
    importAliases?: string[];
    scrapedAliases?: string[];
    bomAliases?: string[];
}

export interface UpdateStoreData {
    name?: string;
    location?: string;
    type?: string;
    opmcId?: string;
    rtom?: string;
    isActive?: boolean;
}

export interface StoreWithDetails extends InventoryStore {
    manager?: Partial<User> | null;
    opmcs?: { id: string; name: string; rtom: string }[];
}

export interface GRNItemInput {
    itemId: string;
    quantity: string | number;
    serials?: string[];
    expiryDate?: string | Date;
    locator?: string;
    /** The PO line this receipt line is for: lets one GRN receive the goods of several purchase orders */
    poItemId?: string | null;
    rejectedQty?: number | null;
    rejectReason?: string | null;
}

export interface CreateGRNData {
    storeId: string;
    sourceType: string;
    supplier?: string | null;
    receivedById: string;
    items: GRNItemInput[];
    requestId?: string | null;
    purchaseOrderId?: string | null;
    sltReferenceId?: string | null;
    reference?: string | null;
    documentUrl?: string | null;
    oracleGrnNumber?: string | null;
    vendorInvoiceNumber?: string | null;
    vendorInvoiceDate?: string | null;
    vendorInvoiceGoods?: number | null;
    vendorInvoiceTax?: number | null;
    vendorInvoiceUrl?: string | null;
}

export interface StockIssueRequest {
    storeId: string;
    issuedById: string;
    issueType: string;
    projectId?: string;
    contractorId?: string;
    teamId?: string;
    items: { itemId: string; quantity: number | string; serials?: string[] }[];
}

export interface MrnActionData {
    mrnId: string;
    action: 'APPROVE' | 'REJECT';
    approvedById: string;
}

export interface StockRequestActionData {
    requestId: string;
    action: 'APPROVE' | 'RECALL_APPROVAL' | 'REJECT' | 'RELEASE' | 'RECEIVE' | 'RETURN' | 'ARM_APPROVE' | 'STORES_MANAGER_APPROVE' | 'PROCUREMENT_COMPLETE' | 'GATE_PASSED' | 'CREATE_PO' | 'UPDATE_PROCUREMENT_STATUS' | 'ADJUST_QTY';
    userId: string;
    remarks?: string;
    instanceId?: string;
    /** True when the gate engine already ran the policy's domain action for this approval (email path). */
    domainActionAlreadyDispatched?: boolean;
    procurementStatus?: string;
    items?: {
        id: string;
        approvedQty?: number;
        issuedQty?: number;
        receivedQty?: number;
        orderQty?: number;
        unitPrice?: number;
        taxAmount?: number;
        totalAmount?: number;
    }[];
    // Procurement specific fields
    poNumber?: string;
    vendor?: string;
    /** Vendor record chosen on the purchase-order screen (preferred over the typed name). */
    vendorId?: string;
    currency?: string;
    /** HO mode: the approval given in the HO system for the purchase order being created */
    ho?: { ref?: string | null; date?: string | null; approvedBy?: string | null; documentUrl?: string | null } | null;
    /** HO mode: how the order is paid */
    credit?: { basis?: string | null; creditDays?: number | string | null; dueDate?: string | null } | null;
    expectedDelivery?: string;
    irNumber?: string;
    isCoveringPO?: boolean;
}

export interface PickedBatch {
    batchId: string | null;
    quantity: number;
    batch: Partial<InventoryBatch>;
}
