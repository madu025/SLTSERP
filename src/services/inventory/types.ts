import {
    InventoryStore,
    InventoryBatch,
    User,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
}

export interface CreateGRNData {
    storeId: string;
    sourceType: string;
    supplier?: string;
    receivedById: string;
    items: GRNItemInput[];
    requestId?: string;
    sltReferenceId?: string;
}

export interface StockIssueRequest {
    storeId: string;
    issuedById: string;
    issueType: string;
    projectId?: string;
    contractorId?: string;
    teamId?: string;
    items: { itemId: string; quantity: number | string }[];
}

export interface MrnActionData {
    mrnId: string;
    action: 'APPROVE' | 'REJECT';
    approvedById: string;
}

export interface StockRequestActionData {
    requestId: string;
    action: 'APPROVE' | 'REJECT' | 'RELEASE' | 'RECEIVE' | 'RETURN' | 'ARM_APPROVE' | 'STORES_MANAGER_APPROVE' | 'PROCUREMENT_COMPLETE';
    userId: string;
    remarks?: string;
    items?: {
        id: string;
        approvedQty?: number;
        issuedQty?: number;
        receivedQty?: number;
    }[];
    // Procurement specific fields
    poNumber?: string;
    vendor?: string;
    expectedDelivery?: string;
    irNumber?: string;
    isCoveringPO?: boolean;
}

export interface PickedBatch {
    batchId: string;
    quantity: number;
    batch: InventoryBatch;
}
