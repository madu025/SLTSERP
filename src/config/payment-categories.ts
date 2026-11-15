import { ACCOUNTS } from '@/services/finance/account-codes';

/**
 * The kinds of payment OSP Finance sends to Head Office, and the conditions each one is paid under.
 * One place for the rules; the services enforce them (the UI only prefills from here).
 */
export type PaymentCategory = 'VENDOR_GOODS' | 'PROJECT_CONTRACTOR' | 'SOD_CONTRACTOR' | 'SITE_OFFICE_RENT' | 'VEHICLE_RENTAL' | 'OTHER_SERVICE';

export interface PaymentCategoryRule {
    label: string;
    /** Expense account debited when a service invoice of this category is approved (goods and contractor invoices post elsewhere). */
    expenseAccount: string | null;
    /** Withholding tax prefilled on a payment request, as a percentage of the amount; editable per request. Rates are defaults for Finance to confirm. */
    defaultWhtPercent: number;
    allowPartial: boolean;
    allowRetention: boolean;
    /** What must exist before a payment request can be made. */
    requires: string;
}

export const PAYMENT_CATEGORIES: Record<PaymentCategory, PaymentCategoryRule> = {
    VENDOR_GOODS: { label: 'Vendor goods', expenseAccount: null, defaultWhtPercent: 0, allowPartial: true, allowRetention: false, requires: 'An approved supplier invoice' },
    PROJECT_CONTRACTOR: { label: 'OSP project contractors', expenseAccount: null, defaultWhtPercent: 0, allowPartial: true, allowRetention: true, requires: 'An issued contractor invoice on the project' },
    SOD_CONTRACTOR: { label: 'SOD contractors', expenseAccount: null, defaultWhtPercent: 0, allowPartial: true, allowRetention: false, requires: 'An approved monthly contractor invoice linked to a project' },
    SITE_OFFICE_RENT: { label: 'Site office rent', expenseAccount: ACCOUNTS.RENT_EXPENSE, defaultWhtPercent: 10, allowPartial: true, allowRetention: false, requires: 'An approved rent invoice (from the site office agreement)' },
    VEHICLE_RENTAL: { label: 'Vehicle rentals', expenseAccount: ACCOUNTS.VEHICLE_EXPENSE, defaultWhtPercent: 5, allowPartial: true, allowRetention: false, requires: 'An approved vehicle rental invoice (from the approved monthly summary)' },
    OTHER_SERVICE: { label: 'Other services', expenseAccount: ACCOUNTS.OSP_EXPENSE, defaultWhtPercent: 0, allowPartial: true, allowRetention: false, requires: 'An approved service invoice' },
};

export const SERVICE_CATEGORIES = ['SITE_OFFICE_RENT', 'VEHICLE_RENTAL', 'OTHER_SERVICE'] as const;
export type ServiceCategory = typeof SERVICE_CATEGORIES[number];
export const isServiceCategory = (c: string): c is ServiceCategory => (SERVICE_CATEGORIES as readonly string[]).includes(c);

/** The supplier-invoice category stored in the database mapped to the payment category. */
export function categoryOfSupplierInvoice(dbCategory: string | null | undefined): PaymentCategory {
    if (dbCategory === 'SITE_OFFICE_RENT' || dbCategory === 'VEHICLE_RENTAL' || dbCategory === 'OTHER_SERVICE') return dbCategory;
    return 'VENDOR_GOODS';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function defaultWhtFor(category: PaymentCategory, amount: number): number {
    return round2((amount * PAYMENT_CATEGORIES[category].defaultWhtPercent) / 100);
}

/** The conditions of a payment request for a category, against what is still payable. Returns the reason it breaks them, or null. */
export function requestBlocker(category: PaymentCategory, p: { amount: number; payable: number; retention?: number; taxWithheld?: number }): string | null {
    const rule = PAYMENT_CATEGORIES[category];
    if (!(p.amount > 0)) return 'AMOUNT_MUST_BE_POSITIVE';
    if (Math.round(p.amount * 100) / 100 !== p.amount) return 'AMOUNT_MUST_HAVE_AT_MOST_TWO_DECIMALS';
    if (p.amount > p.payable + 0.005) return 'AMOUNT_EXCEEDS_WHAT_IS_STILL_PAYABLE';
    if (!rule.allowPartial && p.amount < p.payable - 0.005) return `${rule.label.toUpperCase().replace(/ /g, '_')}_MUST_BE_PAID_IN_FULL`;
    if ((p.retention ?? 0) > 0 && !rule.allowRetention) return 'RETENTION_NOT_ALLOWED_FOR_THIS_CATEGORY';
    if ((p.taxWithheld ?? 0) + (p.retention ?? 0) >= p.amount) return 'DEDUCTIONS_MUST_BE_BELOW_THE_AMOUNT';
    return null;
}
