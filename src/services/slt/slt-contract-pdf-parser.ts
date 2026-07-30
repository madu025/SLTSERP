/**
 * ⚡ SLT Contract & Amendment PDF Extraction Engine (v2)
 *
 * 100% local extraction. NO external cloud APIs or keys required.
 * Tuned against the real SLT agreement corpus in /Agreement:
 *   - Principal Contract L/0733/2025 (FTTH New Connections, digital text)
 *   - Amendment 01 / Amendment 03 for L/0076/2024 (digital text)
 *
 * Handles two document types (CONTRACT vs AMENDMENT) and gracefully flags
 * scanned/image-only PDFs (e.g. the 2024 L/0076/2024 principal contract) that
 * carry no extractable text layer and therefore require manual entry / OCR.
 */

const MONTH_MAP: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
};

const BASELINE = {
    baseUnitRate: 11000,
    poleRate56: 7547.78,
    poleRate67: 10396.84,
    poleRate80: 17369.34,
    poleAdminFee: 500,
    peoTvRate: 4350,
    poleErectRate: 10114.29,
    distanceThresholdMeters: 180,
    totalTargetVolume: 120000
};

export interface ExtractedAmendment {
    amendmentNumber: string;
    reason: string;
    effectiveDate: string;
    revisedUnitRate?: number;
    revisedTargetVolume?: number;
    revisedPoleRate?: number;
    targetMonths: number[];
    ceilingValue?: number;
    ceilingIncrease?: number;
}

export interface ExtractedContract {
    documentType: 'CONTRACT' | 'AMENDMENT' | 'UNKNOWN';
    isScanned: boolean;
    contractNumber: string;
    title: string;
    startDate: string;
    endDate: string;
    baseUnitRate: number;
    poleRate56: number;
    poleRate67: number;
    poleRate80: number;
    poleAdminFee: number;
    peoTvRate: number;
    poleErectRate: number;
    distanceThresholdMeters: number;
    perMeterRate: number;
    ceilingValue?: number;
    totalTargetVolume: number;
    monthlyTargets: Array<{ month: number; volume: string; rate: string }>;
    amendment: ExtractedAmendment | null;
    detectedVariations: string[];
    warnings: string[];
}

function toNumber(raw: string | undefined | null): number | undefined {
    if (!raw) return undefined;
    const n = parseFloat(String(raw).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : undefined;
}

/** Collapse the "-- N of M --" page markers & multi-space runs for reliable matching */
function meaningfulText(text: string): string {
    return text
        .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, ' ')
        .replace(/Docusign Envelope ID:[^\n]*/gi, ' ')
        .replace(/This page kept intentionally blank/gi, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function isScannedDocument(rawText: string, pages: number): boolean {
    const clean = meaningfulText(rawText).replace(/\s+/g, ' ').trim();
    // Digital contracts yield thousands of chars; scanned image PDFs yield only
    // page markers (~a few chars per page). Threshold scales with page count.
    const minExpected = Math.max(300, pages * 40);
    return clean.length < minExpected;
}

function detectDocumentType(text: string): 'CONTRACT' | 'AMENDMENT' {
    if (/AMENDMENT\s*(?:No\.?|-)?\s*0*\d+/i.test(text) &&
        (/come into force/i.test(text) || /THIS AMENDMENT/i.test(text) || /this Amendment/i.test(text))) {
        return 'AMENDMENT';
    }
    if (/PRINCIPAL CONTRACT|UNIT RATE CONTRACT is made|maximum ceiling value/i.test(text)) {
        return 'CONTRACT';
    }
    return 'AMENDMENT'; // amendment templates are the common upload after the principal contract
}

function extractContractNumber(text: string, preferPrincipal: boolean): string {
    // Real formats: L/0733/2025, L/0076/2024
    const all = [...text.matchAll(/\b([A-Z]\/\d{3,4}\/\d{4})\b/g)].map(m => m[1]);
    if (all.length === 0) {
        const generic = text.match(/(?:Agreement No|Contract No|Tender No|Ref)[.:\s]*([A-Z0-9/_-]{4,})/i);
        return generic?.[1]?.trim() || '';
    }
    if (preferPrincipal) {
        // Principal contract number is usually the most frequent / first standalone token
        return all[0];
    }
    return all[0];
}

function extractPeriodDates(text: string): { startDate: string; endDate: string } | null {
    // "during the period from 01st January 2026 to 31st December 2026"
    const m = text.match(
        /period\s+from\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\s+to\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i
    );
    if (m) {
        const sM = MONTH_MAP[m[2].toLowerCase()] || 1;
        const eM = MONTH_MAP[m[5].toLowerCase()] || 12;
        const startDate = `${m[3]}-${String(sM).padStart(2, '0')}-${String(parseInt(m[1])).padStart(2, '0')}`;
        const endDate = `${m[6]}-${String(eM).padStart(2, '0')}-${String(parseInt(m[4])).padStart(2, '0')}`;
        return { startDate, endDate };
    }
    return null;
}

function extractSingleDate(text: string, keyword: RegExp): string | null {
    const m = text.match(keyword);
    if (m && m[2] && MONTH_MAP[m[2].toLowerCase()] !== undefined) {
        const mm = MONTH_MAP[m[2].toLowerCase()];
        return `${m[3]}-${String(mm).padStart(2, '0')}-${String(parseInt(m[1])).padStart(2, '0')}`;
    }
    return null;
}

function firstRate(text: string, pattern: RegExp, min = 100, max = 10_000_000): number | undefined {
    const m = text.match(pattern);
    if (m && m[1]) {
        const v = toNumber(m[1]);
        if (v !== undefined && v >= min && v <= max) return v;
    }
    return undefined;
}

/** Build the 12-month matrix from a total annual volume + per-connection rate */
function buildMonthlyTargets(totalVolume: number, unitRate: number) {
    const monthlyVolume = Math.round(totalVolume / 12);
    return Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        volume: String(monthlyVolume),
        rate: String(unitRate)
    }));
}

function monthsFromEffective(effectiveDate: string): number[] {
    const m = effectiveDate.match(/^\d{4}-(\d{2})-\d{2}$/);
    const startMonth = m ? parseInt(m[1]) : 1;
    return Array.from({ length: 12 - startMonth + 1 }, (_, i) => startMonth + i);
}

function buildAmendmentReason(text: string): string {
    // Scope to the operative "...desirous of..." purpose clause to avoid picking up
    // noise from the WHEREAS recital clauses (which reference prior amendments).
    const desirous = text.match(/desirous of([\s\S]{0,320}?)(?:\.|to which|NOW THE PARTIES)/i);
    const scope = desirous?.[1] || text;

    const parts: string[] = [];
    if (/extend(?:ing)?\s+the\s+(?:Period|Principal Contract)/i.test(scope) || /extension of the period/i.test(scope)) {
        parts.push('Contract Period Extension');
    }
    if (/increas(?:e|ing)\s+the\s+existing\s+financial\s+ceiling\s+limit/i.test(scope) || /financial ceiling limit/i.test(scope)) {
        parts.push('Financial Ceiling Limit Revision');
    }
    if (/additional\s+scope\s+of\s+work/i.test(scope)) {
        parts.push('Additional Scope of Work');
    }
    if (/Material\s+Delivery/i.test(scope)) {
        parts.push('Material Delivery Assignment');
    }
    return parts.length > 0 ? parts.join(' + ') : 'Contract Amendment';
}

/** Parse the Amendment-03 style item table for revised rates & volumes */
function extractAmendmentTable(text: string) {
    // "FTTH New connections (Model 1B) ... 77,000 10,050.00"
    const conn = text.match(/FTTH New connections[\s\S]{0,120}?([\d,]{4,7})\s+([\d,]+\.\d{2})/i);
    // "Additional Pole Erection Service Charge (Model 1B) ... 12,000 10,116.67"
    const pole = text.match(/Additional Pole Erection Service Charge[\s\S]{0,120}?([\d,]{4,7})\s+([\d,]+\.\d{2})/i);
    return {
        revisedTargetVolume: conn ? toNumber(conn[1]) : undefined,
        revisedUnitRate: conn ? toNumber(conn[2]) : undefined,
        revisedPoleRate: pole ? toNumber(pole[2]) : undefined
    };
}

export function extractContractDataFromPdfText(rawText: string, pages = 1): ExtractedContract {
    const warnings: string[] = [];
    const scanned = isScannedDocument(rawText, pages);
    const text = meaningfulText(rawText);

    if (scanned) {
        warnings.push('This PDF appears to be scanned/image-only (no selectable text). Automatic extraction is not possible — please fill the fields manually or upload a digital (text) version.');
        return {
            documentType: 'UNKNOWN',
            isScanned: true,
            contractNumber: '',
            title: '',
            startDate: '',
            endDate: '',
            baseUnitRate: 0,
            poleRate56: 0,
            poleRate67: 0,
            poleRate80: 0,
            poleAdminFee: 0,
            peoTvRate: 0,
            poleErectRate: 0,
            distanceThresholdMeters: 0,
            perMeterRate: 0,
            totalTargetVolume: 0,
            monthlyTargets: buildMonthlyTargets(0, 0),
            amendment: null,
            detectedVariations: [],
            warnings
        };
    }

    const documentType = detectDocumentType(text);

    // ---- Common: dates ----
    const period = extractPeriodDates(text);
    let startDate = period?.startDate || '';
    let endDate = period?.endDate || '';

    // ---- Rates (present in principal contracts; amendments may override via table) ----
    const baseUnitRate = firstRate(text, /FTTH Provisioning Service Cost\s+([\d,]+\.\d{2})/i, 1000, 100000) ?? BASELINE.baseUnitRate;
    const poleErectRate = firstRate(text, /Additional Pole Erecting Service Cost[\s\S]{0,60}?([\d,]+\.\d{2})/i, 1000, 100000) ?? BASELINE.poleErectRate;
    const peoTvRate = firstRate(text, /Provision of PEO TV Connections\s+([\d,]+\.\d{2})/i, 100, 100000) ?? BASELINE.peoTvRate;
    const poleAdminFee = firstRate(text, /Concrete Pole Administrative Fee[^\d]*?([\d,]+\.\d{2})/i, 1, 100000) ?? BASELINE.poleAdminFee;
    const poleRate67 = firstRate(text, /6\.7m[^\d]*([\d,]+\.\d{2})/i, 1000, 100000) ?? BASELINE.poleRate67;
    const poleRate56 = firstRate(text, /5\.6m[^\d]*([\d,]+\.\d{2})/i, 1000, 100000) ?? BASELINE.poleRate56;
    const poleRate80 = firstRate(text, /8\.0m\)?[^\d]*([\d,]+\.\d{2})/i, 1000, 100000) ?? BASELINE.poleRate80;

    // Drop wire threshold: "wire length of 180M per connection"
    const dwMatch = text.match(/wire length of\s+(\d{2,4})\s*M/i) || text.match(/(\d{2,4})\s*M per connection/i);
    const distanceThresholdMeters = dwMatch ? parseInt(dwMatch[1]) : BASELINE.distanceThresholdMeters;

    // Ceiling value: "(Rs. 2,124,700,000.00)"
    const ceilingMatch = text.match(/ceiling value[\s\S]{0,140}?\(?Rs\.?\s*([\d,]+(?:\.\d+)?)\)?/i)
        || text.match(/\(Rs\.?\s*([\d,]{9,})/i);
    const ceilingValue = ceilingMatch ? toNumber(ceilingMatch[1]) : undefined;

    // Annual target volume: Model 1A qty + Model 1B qty (e.g. 10,000 + 110,000 = 120,000)
    let totalTargetVolume = BASELINE.totalTargetVolume;
    const m1a = text.match(/Model 1A[\s\S]{0,240}?\s(\d[\d,]{3,8})\s+[\d,]+\.\d+/i);
    const m1b = text.match(/Model 1B[\s\S]{0,240}?\s(\d[\d,]{3,8})\s+[\d,]+\.\d+/i);
    const v1a = m1a ? toNumber(m1a[1]) : undefined;
    const v1b = m1b ? toNumber(m1b[1]) : undefined;
    if (v1a !== undefined || v1b !== undefined) {
        totalTargetVolume = (v1a || 0) + (v1b || 0);
    }

    // ---- Title & contract number ----
    let title = '';
    const titleMatch = text.match(/FTTH New Connections through Sri Lanka Telecom Services \(Private\) Limited/i);
    if (titleMatch) {
        title = 'FTTH New Connections through Sri Lanka Telecom Services (Private) Limited';
    } else if (/Unit Rate Contract for FTTH New Connections/i.test(text)) {
        title = 'Unit Rate Contract for FTTH New Connections';
    } else if (/Outside Plant/i.test(text)) {
        title = 'Unit Rate Contract for the Outside Plant Related Works';
    }

    const contractNumber = extractContractNumber(text, documentType === 'CONTRACT');

    // ---- Amendment-specific extraction ----
    let amendment: ExtractedAmendment | null = null;
    if (documentType === 'AMENDMENT') {
        const numMatch = text.match(/AMENDMENT\s*(?:No\.?|-)?\s*0*(\d+)/i);
        const amdNum = numMatch ? numMatch[1] : '01';

        const effectiveDate =
            extractSingleDate(text, /come into force\s+(?:on|from)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i)
            || (period?.startDate ?? '')
            || '';

        const table = extractAmendmentTable(text);

        // Ceiling: "existing financial ceiling limit of LKR 1,832,400,000/- shall be increased by LKR917,308,800/-"
        const ceilMatch = text.match(/ceiling limit of\s*LKR\s*([\d,]+)[^\d]+increased by\s*LKR\s*([\d,]+)/i);
        const amdCeiling = ceilMatch ? toNumber(ceilMatch[1]) : undefined;
        const amdIncrease = ceilMatch ? toNumber(ceilMatch[2]) : undefined;

        const effForMonths = effectiveDate || startDate;
        const targetMonths = effForMonths ? monthsFromEffective(effForMonths) : Array.from({ length: 12 }, (_, i) => i + 1);

        amendment = {
            amendmentNumber: `AMD-${(effectiveDate || startDate || '').slice(0, 4) || 'XXXX'}-${amdNum.padStart(2, '0')}`,
            reason: buildAmendmentReason(text),
            effectiveDate,
            revisedUnitRate: table.revisedUnitRate,
            revisedTargetVolume: table.revisedTargetVolume,
            revisedPoleRate: table.revisedPoleRate,
            targetMonths,
            ceilingValue: amdCeiling,
            ceilingIncrease: amdIncrease
        };

        if (!effectiveDate) {
            warnings.push('Could not detect the amendment effective date automatically — please verify.');
        }
        // For amendments the annual period usually isn't restated; leave dates blank if unknown
        if (!period) {
            startDate = startDate || '';
            endDate = endDate || '';
        }
    } else {
        // Contract: fall back to full calendar year if only a year was found
        if (!period) {
            const yearMatch = text.match(/\b(20\d{2})\b/);
            if (yearMatch) {
                startDate = `${yearMatch[1]}-01-01`;
                endDate = `${yearMatch[1]}-12-31`;
            }
        }
    }

    // ---- Variation detection vs baseline (contracts only) ----
    const detectedVariations: string[] = [];
    if (documentType === 'CONTRACT') {
        const checks: Array<[string, number, number, boolean]> = [
            ['Base Unit Rate', baseUnitRate, BASELINE.baseUnitRate, true],
            ['5.6m Pole Rate', poleRate56, BASELINE.poleRate56, true],
            ['6.7m Pole Rate', poleRate67, BASELINE.poleRate67, true],
            ['8.0m Pole Rate', poleRate80, BASELINE.poleRate80, true],
            ['Pole Admin Fee', poleAdminFee, BASELINE.poleAdminFee, true],
            ['PEO TV Rate', peoTvRate, BASELINE.peoTvRate, true],
            ['Max DW Cap', distanceThresholdMeters, BASELINE.distanceThresholdMeters, false],
            ['Annual Target Volume', totalTargetVolume, BASELINE.totalTargetVolume, false]
        ];
        for (const [label, val, base, isCurrency] of checks) {
            if (val !== base) {
                const fmt = (n: number) => isCurrency ? `LKR ${n.toLocaleString()}` : `${n.toLocaleString()}${label.includes('Cap') ? 'm' : ''}`;
                detectedVariations.push(`⚡ ${label} changed: ${fmt(val)} (Baseline: ${fmt(base)})`);
            }
        }
    }

    // ---- Monthly matrix ----
    const monthlyRate = amendment?.revisedUnitRate ?? baseUnitRate;
    const monthlyVolumeSource = amendment?.revisedTargetVolume ?? totalTargetVolume;
    const monthlyTargets = buildMonthlyTargets(monthlyVolumeSource, monthlyRate);

    return {
        documentType,
        isScanned: false,
        contractNumber,
        title,
        startDate,
        endDate,
        baseUnitRate,
        poleRate56,
        poleRate67,
        poleRate80,
        poleAdminFee,
        peoTvRate,
        poleErectRate,
        distanceThresholdMeters,
        perMeterRate: 0,
        ceilingValue,
        totalTargetVolume,
        monthlyTargets,
        amendment,
        detectedVariations,
        warnings
    };
}
