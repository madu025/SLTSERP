export interface InvoiceCalculationResult {
    totalAmount: number;
    amountA: number;
    amountB: number;
}

export interface InvoiceGenerationParams {
    contractorId: string;
    month: number;
    year: number;
    userId: string;
}

export interface InvoiceNumberParams {
    prefix: string;
    regionName: string;
    yearShort: string;
    monthName: string;
    sequence: string;
}

export interface RetentionReleaseResult {
    invoiceNumber: string;
    status: 'RELEASED' | 'STILL_HOLD';
    reason?: string;
}
