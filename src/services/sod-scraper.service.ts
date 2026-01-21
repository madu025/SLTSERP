import * as cheerio from 'cheerio';

interface SODDetailsData {
    soNum: string;
    status: string;
    customerName?: string;
    address?: string;
    contactNumber?: string;
    serviceType?: string;
    packageType?: string;
    ontSerialNumber?: string;
    dropWireDistance?: string;
    dpDetails?: string;
    completedDate?: string;
    patStatus?: string;
    materialUsage?: Array<{
        itemName: string;
        quantity: string;
        unit?: string;
    }>;
    remarks?: string;
}

export class SODDetailsScraper {
    /**
     * Fetch and parse SOD details from SLT HTML page
     */
    static async fetchSODDetails(
        soNum: string,
        status: string = 'COMPLETED',
        workOrderId: string = '',
        serviceType: string = 'FTTH'
    ): Promise<SODDetailsData | null> {
        try {
            const url = `https://serviceportal.slt.lk/iShamp/contr/sod_details`;
            const params = new URLSearchParams({
                sod: `${soNum}_${status}_${workOrderId}_${serviceType}`
            });

            const response = await fetch(`${url}?${params}`, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html',
                    'User-Agent': 'SLTSERP/1.0'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch SOD details: ${response.status}`);
            }

            const html = await response.text();
            return this.parseSODDetails(html, soNum);

        } catch (error) {
            console.error('[SOD-SCRAPER] Failed to fetch SOD details:', error);
            return null;
        }
    }

    /**
     * Parse HTML and extract SOD details
     */
    private static parseSODDetails(html: string, soNum: string): SODDetailsData {
        const $ = cheerio.load(html);

        const data: SODDetailsData = {
            soNum: soNum,
            status: 'COMPLETED'
        };

        try {
            // Extract data from HTML structure
            // Note: Adjust selectors based on actual HTML structure

            // Customer Information
            data.customerName = this.extractText($, 'label:contains("Customer Name")').trim();
            data.address = this.extractText($, 'label:contains("Address")').trim();
            data.contactNumber = this.extractText($, 'label:contains("Contact")').trim();

            // Service Details
            data.serviceType = this.extractText($, 'label:contains("Service Type")').trim();
            data.packageType = this.extractText($, 'label:contains("Package")').trim();

            // Technical Details
            data.ontSerialNumber = this.extractText($, 'label:contains("ONT Serial")').trim();
            data.dropWireDistance = this.extractText($, 'label:contains("Drop Wire")').trim();
            data.dpDetails = this.extractText($, 'label:contains("DP")').trim();

            // Completion Details
            data.completedDate = this.extractText($, 'label:contains("Completed Date")').trim();
            data.patStatus = this.extractText($, 'label:contains("PAT Status")').trim();

            // Material Usage (if available in table format)
            const materialRows = $('table').find('tr').filter((i, el) => {
                return $(el).text().toLowerCase().includes('material');
            });

            if (materialRows.length > 0) {
                data.materialUsage = [];
                materialRows.each((i, row) => {
                    const cells = $(row).find('td');
                    if (cells.length >= 2) {
                        data.materialUsage?.push({
                            itemName: $(cells[0]).text().trim(),
                            quantity: $(cells[1]).text().trim(),
                            unit: $(cells[2])?.text().trim() || 'pcs'
                        });
                    }
                });
            }

            // Remarks
            data.remarks = this.extractText($, 'label:contains("Remarks")').trim();

        } catch (error) {
            console.error('[SOD-SCRAPER] Error parsing HTML:', error);
        }

        return data;
    }

    /**
     * Helper method to extract text next to a label
     */
    private static extractText($: cheerio.CheerioAPI, selector: string): string {
        const element = $(selector).parent().next();
        return element.text().trim() || '';
    }

    /**
     * Extract all table data from HTML
     */
    static extractTableData(html: string): Record<string, string>[] {
        const $ = cheerio.load(html);
        const tables: Record<string, string>[] = [];

        $('table').each((tableIndex, table) => {
            const rows = $(table).find('tr');

            rows.each((rowIndex, row) => {
                const cells = $(row).find('td, th');
                const rowData: Record<string, string> = {};

                cells.each((cellIndex, cell) => {
                    const text = $(cell).text().trim();
                    if (text) {
                        rowData[`col_${cellIndex}`] = text;
                    }
                });

                if (Object.keys(rowData).length > 0) {
                    tables.push(rowData);
                }
            });
        });

        return tables;
    }

    /**
     * Debug: Save HTML to file for analysis
     */
    static async saveHTMLForAnalysis(soNum: string): Promise<void> {
        try {
            const url = `https://serviceportal.slt.lk/iShamp/contr/sod_details`;
            const params = new URLSearchParams({
                sod: `${soNum}_COMPLETED__FTTH`
            });

            const response = await fetch(`${url}?${params}`);
            const html = await response.text();

            // Save to temp file for analysis
            const fs = await import('fs/promises');
            await fs.writeFile(`./temp_sod_${soNum}.html`, html, 'utf-8');

            console.log(`[SOD-SCRAPER] HTML saved to temp_sod_${soNum}.html`);
        } catch (error) {
            console.error('[SOD-SCRAPER] Failed to save HTML:', error);
        }
    }
}
