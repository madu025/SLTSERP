import { AppError } from '@/lib/error';
// SLT API Service for fetching FTTH service orders
export interface SLTServiceOrderData {
    RTOM: string;
    LEA: string;
    SO_NUM: string;
    VOICENUMBER: string | null;
    ORDER_TYPE: string;
    S_TYPE: string;
    CON_CUS_NAME: string;
    CON_TEC_CONTACT: string | null;
    CON_STATUS: string;
    CON_STATUS_DATE: string;
    ADDRE: string;
    DP: string;
    PKG: string;
    CON_OSP_PHONE_CLASS: string;
    CON_PHN_PURCH: string | null;
    CON_SALES: string;
    CON_WORO_TASK_NAME: string;
    IPTV: string | null;
    CON_WORO_SEIT: string | null;
    FTTH_INST_SIET: string | null;
    FTTH_WIFI: string | null;
}

export interface SLTPATData {
    RTOM: string;
    LEA?: string; // LEA (Optional - missing in HO Rejected)
    SO_NUM: string;
    VOICENUMBER: string | null; // CIRCUIT
    S_TYPE: string; // SERVICE
    ORDER_TYPE: string; // ORDER TYPE
    CON_WORO_TASK_NAME?: string; // TASK (Optional)
    PKG?: string; // PACKAGE (Optional)
    CON_STATUS: string; // STATUS
    CON_NAME?: string; // CONTRACTOR (Optional)
    PAT_USER: string | null; // PAT USER
    CON_STATUS_DATE: string; // COMPLETED ON / RECEIVED ON
}

export interface SLTApiResponse {
    data: SLTServiceOrderData[];
}

/** Rich row from the ishamp RETURNED_SLTS mirror — carries the raw SLT return reason and free-text comment. */
export interface SLTReturnedSODReason {
    SO_NUM: string;
    RTOM?: string;
    LEA?: string;
    RETURNED_DATE?: string;
    RETURNED_REASON?: string;
    RETURNED_COMMENT?: string;
}

export class SLTApiService {
    private baseUrl = 'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php';

    async fetchCompletedSODs(rtom: string, startDate: string, endDate: string): Promise<SLTServiceOrderData[]> {
        const endpoints = [
            `https://ishamp.slt.lk/iShamp/contr/dynamic_load?x=ftth&z=${rtom}_${startDate}_${endDate}_COMPLETED_SLTS`,
            `https://serviceportal.slt.lk/iShamp/contr/dynamic_load?x=ftth&z=${rtom}_${startDate}_${endDate}_COMPLETED_SLTS`,
            `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=ftth&z=${rtom}_${startDate}_${endDate}_COMPLETED_SLTS`
        ];

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    signal: AbortSignal.timeout(30000),
                });

                if (response.ok) {
                    const data: SLTApiResponse = await response.json();
                    if (data && Array.isArray(data.data)) {
                        return data.data.map((item) => {
                            const status = item.CON_STATUS || 'UNKNOWN';
                            return {
                                ...item,
                                CON_STATUS: status === 'ASSIGN' ? 'ASSIGNED' : status,
                                CON_STATUS_DATE: item.CON_STATUS_DATE || new Date().toISOString()
                            } as SLTServiceOrderData;
                        });
                    }
                }
            } catch {
                // Try next endpoint
            }
        }
        return [];
    }

    /**
     * Fetch APPROVED (PAT_PASSED) SODs — fully completed with all PAT levels passed
     */
    async fetchApprovedSODs(rtom: string, startDate: string, endDate: string): Promise<SLTServiceOrderData[]> {
        const endpoints = [
            `https://serviceportal.slt.lk/iShamp/contr/dynamic_load?x=ftth&z=${rtom}_${startDate}_${endDate}_APPROVED_SLTS`,
            `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=ftth&z=${rtom}_${startDate}_${endDate}_APPROVED_SLTS`
        ];

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    signal: AbortSignal.timeout(30000),
                });

                if (response.ok) {
                    const data: SLTApiResponse = await response.json();
                    if (data && Array.isArray(data.data)) {
                        return data.data.map((item) => {
                            const status = item.CON_STATUS || 'PAT_PASSED';
                            return {
                                ...item,
                                CON_STATUS: status === 'ASSIGN' ? 'ASSIGNED' : status,
                                CON_STATUS_DATE: item.CON_STATUS_DATE || new Date().toISOString()
                            } as SLTServiceOrderData;
                        });
                    }
                }
            } catch {
                // Try next endpoint
            }
        }
        return [];
    }

    async fetchServiceOrders(rtom: string): Promise<SLTServiceOrderData[]> {
        try {
            const url = `${this.baseUrl}?x=ftthpen&z=SLTS_${rtom}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                // Timeout after 60 seconds
                signal: AbortSignal.timeout(60000),
            });

            if (!response.ok) {
                throw AppError.badRequest(`SLT API returned ${response.status}: ${response.statusText}`);
            }

            const data: SLTApiResponse = await response.json();

            if (!data || !Array.isArray(data.data)) {
                console.warn(`Invalid response format from SLT API for RTOM ${rtom}`);
                return [];
            }

            // If no items, return empty
            if (!data.data || !Array.isArray(data.data)) {
                return [];
            }

            return data.data.map((item) => {
                // Ensure consistency and normalize ASSIGN -> ASSIGNED
                const status = item.CON_STATUS || 'UNKNOWN';
                return {
                    ...item,
                    CON_STATUS: status === 'ASSIGN' ? 'ASSIGNED' : status,
                    CON_STATUS_DATE: item.CON_STATUS_DATE || new Date().toISOString()
                } as SLTServiceOrderData;
            });
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    console.error(`SLT API timeout for RTOM ${rtom}`);
                    throw AppError.badRequest(`SLT Portal connection timed out (server unreachable)`);
                } else {
                    console.error(`SLT API error for RTOM ${rtom}:`, error.message);
                    throw AppError.badRequest(`SLT Portal returned error: ${error.message}`);
                }
            }
            throw AppError.badRequest(`SLT Portal connection failed: Unknown error`);
        }
    }

    async fetchPATResults(rtom: string): Promise<SLTPATData[]> {
        // Fallback or Regional specific if ever needed
        try {
            const url = `${this.baseUrl}?x=patsuccess&z=SLTS_${rtom}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: AbortSignal.timeout(120000),
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data.data) ? data.data : [];
        } catch {
            return [];
        }
    }

    /**
     * Fetch Global Head Office Approved PAT Results (Fixed URL)
     */
    async fetchHOApprovedGlobal(): Promise<SLTPATData[]> {
        try {
            const url = `${this.baseUrl}?x=patsuccess&con=SLTS`;
            console.log(`[SLT-API] Fetching global HO Approved results from: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                // Increased timeout to 5 minutes for massive JSON
                signal: AbortSignal.timeout(300000),
            });

            if (!response.ok) throw AppError.badRequest(`HO Approved API returned ${response.status}`);

            const data = await response.json();
            const count = Array.isArray(data.data) ? data.data.length : 0;
            console.log(`[SLT-API] Successfully fetched ${count} HO Approved records.`);

            return Array.isArray(data.data) ? data.data : [];
        } catch (error) {
            console.error(`SLT Global HO Approved API error:`, error);
            return [];
        }
    }

    /**
     * Fetch HO Approved PAT Results by date (Smaller, more stable chunks)
     * @param dateStr Format: YYYY-MM-DD
     */
    async fetchPATResultsByDate(dateStr: string): Promise<SLTPATData[]> {
        try {
            const url = `${this.baseUrl}?x=patsuccess&y=${dateStr}&con=SLTS`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: AbortSignal.timeout(60000),
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data.data) ? (data.data as SLTPATData[]) : [];
        } catch (error) {
            console.error("SLT API error:", error);
            return [];
        }
    }

    /**
     * Fetch Regionally Rejected PAT Results
     */
    async fetchOpmcRejected(rtom: string): Promise<SLTPATData[]> {
        try {
            const url = `${this.baseUrl}?x=opmcpatrej&z=SLTS_${rtom}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: AbortSignal.timeout(60000),
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data.data) ? data.data : [];
        } catch (err) {
            console.error(`SLT OPMC REJ API error for RTOM ${rtom}:`, err);
            return [];
        }
    }

    /**
     * Fetch Head Office Rejected PAT Results
     */
    async fetchHORejected(dateStr?: string): Promise<SLTPATData[]> {
        try {
            const url = `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patreject&y=${dateStr || ''}&con=SLTS`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: AbortSignal.timeout(60000),
            });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data.data) ? data.data : [];
        } catch (err) {
            console.error(`SLT HO REJ API error:`, err);
            return [];
        }
    }

    /**
     * Fetch RETURNED SODs from SLT portal
     */
    async fetchReturnedSODs(rtom: string, startDate: string, endDate: string): Promise<SLTServiceOrderData[]> {
        const endpoints = [
            `https://serviceportal.slt.lk/iShamp/contr/dynamic_load?x=ftth&z=${rtom}_${startDate}_${endDate}_RETURNED_SLTS`,
            `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=ftth&z=${rtom}_${startDate}_${endDate}_RETURNED_SLTS`
        ];

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    signal: AbortSignal.timeout(30000),
                });

                if (response.ok) {
                    const data: SLTApiResponse = await response.json();
                    if (data && Array.isArray(data.data)) {
                        return data.data.map((item) => {
                            const status = item.CON_STATUS || 'RETURN';
                            return {
                                ...item,
                                CON_STATUS: status === 'ASSIGN' ? 'ASSIGNED' : status,
                                CON_STATUS_DATE: item.CON_STATUS_DATE || new Date().toISOString()
                            } as SLTServiceOrderData;
                        });
                    }
                }
            } catch {
                // Try next endpoint
            }
        }
        return [];
    }

    /**
     * Fetch RETURNED SODs with the raw reason/comment fields from the ishamp mirror.
     * The serviceportal RETURNED_SLTS view only exposes CON_STATUS; the ishamp mirror
     * additionally returns RETURNED_DATE, RETURNED_REASON and RETURNED_COMMENT —
     * the only source of the actual return explanation (e.g. "OSS DATA ERROR" +
     * "LEA Changed (HC)") for rows classified as OTHER.
     */
    async fetchReturnedSODReasons(rtom: string, startDate: string, endDate: string): Promise<SLTReturnedSODReason[]> {
        const endpoints = [
            `https://ishamp.slt.lk/iShamp/contr/dynamic_load?x=ftth&z=${rtom}_${startDate}_${endDate}_RETURNED_SLTS`,
            `https://ishamp.slt.lk/iShamp/contr/dynamic_load.php?x=ftth&z=${rtom}_${startDate}_${endDate}_RETURNED_SLTS`,
            `https://serviceportal.slt.lk/iShamp/contr/dynamic_load?x=ftth&z=${rtom}_${startDate}_${endDate}_RETURNED_SLTS`
        ];

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept-Language': 'en-US,en;q=0.9',
                    },
                    signal: AbortSignal.timeout(30000),
                });

                if (response.ok) {
                    const data: { data?: Record<string, unknown>[] } = await response.json();
                    if (data && Array.isArray(data.data)) {
                        const rows = data.data
                            .filter(item => typeof item.SO_NUM === 'string' && (item as { SO_NUM: string }).SO_NUM)
                            .map(item => ({
                                SO_NUM: String(item.SO_NUM),
                                RTOM: item.RTOM ? String(item.RTOM) : undefined,
                                LEA: item.LEA ? String(item.LEA) : undefined,
                                RETURNED_DATE: item.RETURNED_DATE ? String(item.RETURNED_DATE) : undefined,
                                RETURNED_REASON: item.RETURNED_REASON ? String(item.RETURNED_REASON) : undefined,
                                RETURNED_COMMENT: item.RETURNED_COMMENT ? String(item.RETURNED_COMMENT) : undefined,
                            }));
                        if (rows.length > 0) return rows;
                    }
                }
            } catch {
                // Try next endpoint
            }
        }
        return [];
    }

    parseStatusDate(dateStr: string | null): Date | null {
        if (!dateStr) return null;
        try {
            // Format: "12/16/2025 06:05:34 PM"
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        } catch {
            return null;
        }
    }
}

export const sltApiService = new SLTApiService();
