import { InventoryItem as PrismaInventoryItem } from "@prisma/client";

export interface InventoryItem extends PrismaInventoryItem {
    commonName: string | null;
    sltCode: string | null;
    description: string | null;
}

export interface ItemFormValues {
    code: string;
    sltCode?: string | null;
    name: string;
    commonName: string;
    unit: 'Nos' | 'kg' | 'L' | 'm' | 'km' | 'pkts' | 'Box' | 'Bot' | 'Set' | 'Roll' | 'gram' | 'ml';
    type: 'SLT' | 'SLTS';
    category: string;
    commonFor?: string[];
    minLevel?: string | number;
    isWastageAllowed: boolean;
    maxWastagePercentage?: string | number;
    unitPrice?: string | number;
    costPrice?: string | number;
    hasSerial: boolean;
    description?: string | null;
    importAliases?: string[];
}
