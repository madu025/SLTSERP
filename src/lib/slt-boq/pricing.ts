/**
 * SLT unit-designator pricing (BOQ and invoice arithmetic).
 *
 * Every unit designator has three base prices:
 *   P0 = main material + accessories + services/overhead
 *   P1 = accessories + services/overhead   (material supplied by SLT)
 *   P2 = services/overhead only            (material and accessories supplied by SLT)
 * A BOQ line is priced at ONE tier (the one that matches who supplies what) and its amount is quantity x rate of
 * that tier. Customer-request (STANDARD) BOQs additionally split the base price into material / accessories /
 * services and apply an increment factor to each part.
 *
 * All figures were reconciled against the sample documents (CR2304, CEN-AMR-0517, MKT-928).
 */

export type SupplyTier = 'P0' | 'P1' | 'P2';

export const SSCL_PERCENT = 2.56;
export const VAT_PERCENT = 18;

export interface BoqLineInput {
    udNo?: number | null;
    unitDesignator: string;
    description: string;
    unit: string;
    quantity: number;
    supplyTier: SupplyTier;
    rateP0: number;
    rateP1: number;
    rateP2: number;
    boqPart?: string | null;
}

export interface IncrementFactors {
    material: number;
    accessories: number;
    services: number;
}

export const NO_INCREMENT: IncrementFactors = { material: 1, accessories: 1, services: 1 };
/** Customer request / rehabilitation BOQs: material and accessories x1.13, services x1.10 */
export const STANDARD_INCREMENT: IncrementFactors = { material: 1.13, accessories: 1.13, services: 1.1 };

/** Half-up to cents; the product is de-noised first so 1.005-style float results round the way a calculator would */
export const round2 = (n: number): number => Math.round(Number((n * 100).toPrecision(15))) / 100;
export const round4 = (n: number): number => Math.round(Number((n * 10000).toPrecision(15))) / 10000;

export function tierRate(line: Pick<BoqLineInput, 'rateP0' | 'rateP1' | 'rateP2'>, tier: SupplyTier): number {
    return tier === 'P0' ? line.rateP0 : tier === 'P1' ? line.rateP1 : line.rateP2;
}

/** The tier a line is priced at when only its rates are known (rates collapse when SLT supplies the material). */
export function inferTierFromRates(rateP0: number, rateP1: number, rateP2: number): SupplyTier {
    const materialPart = rateP0 - rateP1;
    const accessoriesPart = rateP1 - rateP2;
    if (materialPart === 0 && accessoriesPart === 0) return 'P2';
    if (materialPart === 0) return 'P1';
    return 'P0';
}

export interface Components {
    material: number;
    accessories: number;
    services: number;
}

/** Base unit price split into its parts for the line's tier */
export function unitComponents(line: BoqLineInput): Components {
    const { rateP0, rateP1, rateP2, supplyTier } = line;
    return {
        material: supplyTier === 'P0' ? rateP0 - rateP1 : 0,
        accessories: supplyTier === 'P2' ? 0 : rateP1 - rateP2,
        services: rateP2,
    };
}

/** Unit price as it appears on the invoice for the line's tier (increment applied to each part) */
export function invoiceUnitRate(line: BoqLineInput, inc: IncrementFactors): number {
    const c = unitComponents(line);
    return round2(c.material * inc.material + c.accessories * inc.accessories + c.services * inc.services);
}

export interface LineAmounts {
    components: Components;
    withIncrement: Components;
    base: number;
    total: number;
}

export function lineAmounts(line: BoqLineInput, inc: IncrementFactors): LineAmounts {
    const c = unitComponents(line);
    const q = line.quantity;
    const components = { material: c.material * q, accessories: c.accessories * q, services: c.services * q };
    const withIncrement = {
        material: components.material * inc.material,
        accessories: components.accessories * inc.accessories,
        services: components.services * inc.services,
    };
    return {
        components,
        withIncrement,
        base: tierRate(line, line.supplyTier) * q,
        total: withIncrement.material + withIncrement.accessories + withIncrement.services,
    };
}

export interface TaxBreakdown {
    gross: number;
    sscl: number;
    afterSscl: number;
    vat: number;
    net: number;
}

/** SLT tax order: SSCL on the gross value, then VAT on (gross + SSCL) */
export function taxBreakdown(gross: number, ssclPercent = SSCL_PERCENT, vatPercent = VAT_PERCENT): TaxBreakdown {
    const sscl = gross * ssclPercent / 100;
    const afterSscl = gross + sscl;
    const vat = afterSscl * vatPercent / 100;
    return { gross, sscl, afterSscl, vat, net: afterSscl + vat };
}

/**
 * Tax as it is printed and stored on an invoice: every figure is rounded to cents in order, so
 * gross + SSCL + VAT always equals the net total shown.
 */
export function invoiceTax(gross: number, ssclPercent = SSCL_PERCENT, vatPercent = VAT_PERCENT): TaxBreakdown {
    const g = round2(gross);
    const sscl = round2(g * ssclPercent / 100);
    const afterSscl = round2(g + sscl);
    const vat = round2(afterSscl * vatPercent / 100);
    return { gross: g, sscl, afterSscl, vat, net: round2(afterSscl + vat) };
}

export interface TierTotals { P0: number; P1: number; P2: number }

/** Invoice value grouped by the tier each line is priced at (the P0 / P1 / P2 rows of the tax invoice) */
export function invoiceTierTotals(lines: BoqLineInput[], inc: IncrementFactors): TierTotals {
    const totals: TierTotals = { P0: 0, P1: 0, P2: 0 };
    for (const line of lines) {
        totals[line.supplyTier] += round2(invoiceUnitRate(line, inc) * line.quantity);
    }
    return { P0: round2(totals.P0), P1: round2(totals.P1), P2: round2(totals.P2) };
}

export interface BoqSummary {
    components: Components;
    withIncrement: Components;
    gross: number;
    tax: TaxBreakdown;
}

/** Customer request BOQ summary: parts, increment, gross, SSCL, VAT */
export function summarizeStandardBoq(lines: BoqLineInput[], inc: IncrementFactors): BoqSummary {
    const components: Components = { material: 0, accessories: 0, services: 0 };
    const withIncrement: Components = { material: 0, accessories: 0, services: 0 };
    for (const line of lines) {
        const a = lineAmounts(line, inc);
        for (const k of ['material', 'accessories', 'services'] as const) {
            components[k] += a.components[k];
            withIncrement[k] += a.withIncrement[k];
        }
    }
    const gross = withIncrement.material + withIncrement.accessories + withIncrement.services;
    return { components, withIncrement, gross, tax: taxBreakdown(gross) };
}

export interface PartSummary {
    part: string;
    tierTotals: TierTotals;
    contingencyPercent: number;
    contingency: TierTotals;
    subTotal: TierTotals;
    total: number;
    withSscl: number;
    withVat: number;
}

/** Cluster BOQ part (BOQ-1 / BOQ-2): tier totals + contingency, then SSCL and VAT */
export function summarizePart(part: string, lines: BoqLineInput[], contingencyPercent: number): PartSummary {
    const tierTotals: TierTotals = { P0: 0, P1: 0, P2: 0 };
    for (const line of lines) tierTotals[line.supplyTier] += tierRate(line, line.supplyTier) * line.quantity;
    const contingency: TierTotals = {
        P0: tierTotals.P0 * contingencyPercent / 100,
        P1: tierTotals.P1 * contingencyPercent / 100,
        P2: tierTotals.P2 * contingencyPercent / 100,
    };
    const subTotal: TierTotals = { P0: tierTotals.P0 + contingency.P0, P1: tierTotals.P1 + contingency.P1, P2: tierTotals.P2 + contingency.P2 };
    const total = subTotal.P0 + subTotal.P1 + subTotal.P2;
    const tax = taxBreakdown(total);
    return { part, tierTotals, contingencyPercent, contingency, subTotal, total, withSscl: tax.afterSscl, withVat: tax.net };
}
