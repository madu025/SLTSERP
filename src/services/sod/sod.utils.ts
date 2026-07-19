export class SodUtils {
    /**
     * Parse scraped master details from a mashed string
     */
    static deepParse(masterData: Record<string, string>): Record<string, string> {
        const mashed = masterData['SERVICE ORDER DETAILS'] || "";
        if (!mashed || mashed.length < 50) return {};

        const extracted: Record<string, string> = {};
        const keywords = [
            'RTOM', 'SERVICE ORDER', 'CIRCUIT', 'SERVICE', 'RECEIVED DATE',
            'CUSTOMER NAME', 'CONTACT NO', 'ADDRESS', 'STATUS', 'STATUS DATE',
            'ORDER TYPE', 'TASK', 'PACKAGE', 'EQUIPMENT CLASS',
            'EQUIPMENT PURCHASE FROM SLT', 'SALES PERSON', 'DP LOOP',
            'CONTRACTOR', 'TEAM', 'CON_NAME', 'MOBILE_TEAM'
        ];

        keywords.forEach((key) => {
            const start = mashed.indexOf(key);
            if (start === -1) return;

            let end = mashed.length;
            for (let j = 0; j < keywords.length; j++) {
                const nextKey = keywords[j];
                const nextIdx = mashed.indexOf(nextKey, start + key.length);
                if (nextIdx !== -1 && nextIdx < end) {
                    end = nextIdx;
                }
            }

            let val = mashed.substring(start + key.length, end).trim();
            if (key === 'RTOM') val = val.replace('R-', '');
            if (key === 'CIRCUIT') val = val.split(' ')[0];

            extracted[key] = val;
        });

        return extracted;
    }

    /**
     * Safely parse dates from SLT ERP string values
     */
    static safeParseDate(dateStr: string | Date | undefined | null): Date | undefined {
        if (!dateStr) return undefined;
        if (dateStr instanceof Date) return dateStr;
        if (typeof dateStr === 'string' && dateStr.trim() === "") return undefined;
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? undefined : d;
    }
}
