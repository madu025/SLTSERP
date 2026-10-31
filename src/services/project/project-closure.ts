export interface ClosureInvoice {
    type: string;
    status: string;
    submissionStatus: string;
    paymentStatus: string;
    totalAmount: unknown;
    paidAmount: unknown;
    balanceAmount: unknown;
}

export interface ClosureStage {
    code: string | null;
    name: string;
    sequence: number;
    status: string;
}

export function getIncompleteClosureStages(stages: ClosureStage[]): string[] {
    if (stages.length === 0) return ['Workflow has no stages'];
    const closingStage = stages.find(stage => stage.code === 'PROJECT_CLOSURE'
        || stage.name.toLowerCase().includes('closure'));
    const requiredStages = closingStage
        ? stages.filter(stage => stage !== closingStage)
        : stages;
    return requiredStages.filter(stage => stage.status !== 'COMPLETED').map(stage => stage.name);
}

export function isInvoiceOpenForClosure(invoice: ClosureInvoice): boolean {
    if (invoice.status === 'CANCELLED') return false;
    const total = Number(invoice.totalAmount);
    const paid = Number(invoice.paidAmount);
    const balance = Number(invoice.balanceAmount);
    if (!Number.isFinite(total) || !Number.isFinite(paid) || !Number.isFinite(balance)) return true;
    if (balance !== 0 || paid < total) return true;
    if (invoice.type === 'CLIENT') {
        return invoice.submissionStatus !== 'SUBMITTED_TO_SLT' || invoice.paymentStatus !== 'PAID';
    }
    return !['PAID', 'FULLY_PAID', 'COMPLETED'].includes(invoice.status);
}
