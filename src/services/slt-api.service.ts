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

export class SLTApiService {
    private baseUrl = 'https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php';

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
                // Timeout after 30 seconds
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) {
                throw new Error(`SLT API returned ${response.status}: ${response.statusText}`);
            }

            const data: SLTApiResponse = await response.json();

            if (!data || !Array.isArray(data.data)) {
                console.warn(`Invalid response format from SLT API for RTOM ${rtom}`);
                return [];
            }

            return data.data;
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    console.error(`SLT API timeout for RTOM ${rtom}`);
                } else {
                    console.error(`SLT API error for RTOM ${rtom}:`, error.message);
                }
            }
            // Return empty array on error - don't crash
            return [];
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
        } catch (error) {
            return [];
        }
    }

    /**
     * Fetch Global Head Office Approved PAT Results (Fixed URL)
     */
    async fetchHOApprovedGlobal(): Promise<SLTPATData[]> {
        try {
            const url = `${this.baseUrl}?x=patsuccess&y=&con=SLTS`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                signal: AbortSignal.timeout(120000),
            });
            if (!response.ok) throw new Error(`HO Approved API returned ${response.status}`);
            const data = await response.json();
            return Array.isArray(data.data) ? data.data : [];
        } catch (error) {
            console.error(`SLT Global HO Approved API error:`, error);
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
    async fetchHORejected(): Promise<SLTPATData[]> {
        try {
            // Note: Uses dynamic_load.php as per user instructions
            const url = `https://serviceportal.slt.lk/iShamp/contr/dynamic_load.php?x=patreject&y=&con=SLTS`;
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
