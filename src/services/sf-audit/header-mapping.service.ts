import { prisma } from '@/lib/prisma';

export interface MappingColumnDTO {
    key: string;
    label: string;
    description: string;
    category?: string;
    syncMode?: 'AUTO' | 'MANUAL'; // AUTO = synced from system, MANUAL = hand-entered
    terms: string[];
}

const CONFIG_KEY = 'SF_AUDIT_INVOICE_HEADER_MAPPING';
const OSP_CATEGORY_ORDER_KEY = 'OSP_CATEGORY_ORDER';

export class HeaderMappingService {
    /**
     * Dynamically build mapping rules from Admin Settings active Common Category Groups.
     * Items belonging to the same Common Category Group (e.g. ROSETTE, FAC CONNECTOR, HOOK C, HOOK L, BOLT & NUTS)
     * are consolidated into ONE SINGLE column header row with all matched aliases combined.
     * Matched Aliases & Terms are taken directly from Admin/Settings (item.code, item.sltCode, item.importAliases).
     */
    private static async getDynamicDatabaseMapping(): Promise<MappingColumnDTO[]> {
        // 1. Fetch active OSP/FTTH items configured in admin/settings
        const activeItems = await prisma.inventoryItem.findMany({
            where: { isOspFtth: true },
            select: {
                id: true,
                code: true,
                name: true,
                description: true,
                commonName: true,
                sltCode: true,
                importAliases: true,
                category: true,
                type: true
            }
        });

        // 2. Fetch active category order configured in admin/settings
        let categoryOrder: string[] = [];
        const categoryOrderConfig = await prisma.systemConfig.findUnique({
            where: { key: OSP_CATEGORY_ORDER_KEY },
            select: { value: true }
        });

        if (categoryOrderConfig?.value) {
            try {
                categoryOrder = JSON.parse(categoryOrderConfig.value);
            } catch (e) {
                console.error('[HEADER_MAPPING] Failed to parse OSP_CATEGORY_ORDER', e);
            }
        }

        const itemsToProcess = activeItems.length > 0 ? activeItems : await prisma.inventoryItem.findMany({
            orderBy: { code: 'asc' },
            select: {
                id: true,
                code: true,
                name: true,
                description: true,
                commonName: true,
                sltCode: true,
                importAliases: true,
                category: true,
                type: true
            }
        });

        if (itemsToProcess.length === 0) {
            // Standard SLT BOM default headers fallback
            return [
                { key: 'F1', label: 'F1', description: 'Fiber 1 Drop Wire Cable (SLT)', category: 'DROP WIRE', syncMode: 'AUTO', terms: ['F1', 'F-1', 'FIBER 1', 'FIBER-1', 'USED_F1', 'OSP-HC-CBL-DW'] },
                { key: 'G1', label: 'G1', description: 'Indoor/Internal Fiber Cable (Contractor)', category: 'DROP WIRE', syncMode: 'MANUAL', terms: ['G1', 'G-1', 'G-HOOK', 'USED_G1', 'OSPFTA003'] },
                { key: 'ROSETTE', label: 'ROSETTE', description: 'Fiber Rosette Box', category: 'ROSETTE', syncMode: 'AUTO', terms: ['ROSETTE', 'FIBER ROSETTE', 'OSPFTA007', 'FWS-1', 'ATB'] },
                { key: 'FAC-CONNECTOR', label: 'FAC CONNECTOR', description: 'Faceplate & FAC Connector', category: 'FAC CONNECTOR', syncMode: 'AUTO', terms: ['FAC', 'FACEPLATE', 'OSP-HC-ACC-FAC', 'OSPFTA002', 'FAC-1'] },
                { key: 'HOOK-C', label: 'HOOK C', description: 'C Hook', category: 'HOOK C', syncMode: 'AUTO', terms: ['HOOK C', 'C-HOOK', 'OSP-NC-MM-CHOOK', 'OSPACC018'] },
                { key: 'HOOK-L', label: 'HOOK L', description: 'L Hook', category: 'HOOK L', syncMode: 'AUTO', terms: ['HOOK L', 'L-HOOK', 'OSP-NC-MM-LHOOK', 'OSPACC017'] },
                { key: 'BOLT-NUTS', label: 'BOLT & NUTS', description: 'Pole Top Bolt & Nuts', category: 'BOLT & NUTS', syncMode: 'AUTO', terms: ['BOLT & NUTS', 'POLE BOLT', 'OSPACC011'] },
                { key: 'CONDUIT', label: 'CONDUIT', description: 'PVC Conduit Pipe', category: 'CONDUIT', syncMode: 'AUTO', terms: ['CONDUIT', 'CONDUITS'] },
                { key: 'CASING', label: 'CASING', description: 'Trunking / PVC Casing', category: 'CASING', syncMode: 'AUTO', terms: ['CASING', 'TRUNKING'] }
            ];
        }

        // Group items by Common Category Group
        const groupedMap = new Map<string, typeof itemsToProcess>();
        itemsToProcess.forEach(item => {
            const catName = (item.commonName || item.category || item.name || item.code).trim().toUpperCase();
            if (!groupedMap.has(catName)) {
                groupedMap.set(catName, []);
            }
            groupedMap.get(catName)!.push(item);
        });

        // Determine Category Group Display Order
        const sortedCategoryNames = Array.from(groupedMap.keys()).sort((a, b) => {
            const idxA = categoryOrder.indexOf(a);
            const idxB = categoryOrder.indexOf(b);
            if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
            if (idxA !== -1 && idxB === -1) return -1;
            if (idxA === -1 && idxB !== -1) return 1;
            return a.localeCompare(b);
        });

        const resultColumns: MappingColumnDTO[] = [];

        sortedCategoryNames.forEach(catName => {
            const groupItems = groupedMap.get(catName) || [];

            // Special Case: DROP WIRE category splits into F1 and G1
            if (catName.includes('DROP WIRE') || catName.includes('DROP CABLE')) {
                const sltItems = groupItems.filter(i => i.type === 'SLT');
                const companyItems = groupItems.filter(i => i.type !== 'SLT');

                // F1 Row (Auto Sync)
                const f1Terms = new Set<string>(['F1', 'F-1', 'USED_F1']);
                (sltItems.length > 0 ? sltItems : groupItems).forEach(item => {
                    if (item.code) f1Terms.add(item.code.trim().toUpperCase());
                    if (item.sltCode) f1Terms.add(item.sltCode.trim().toUpperCase());
                    if (Array.isArray(item.importAliases)) {
                        item.importAliases.forEach(a => {
                            if (a && a.trim()) f1Terms.add(a.trim().toUpperCase());
                        });
                    }
                });

                resultColumns.push({
                    key: 'F1',
                    label: 'F1',
                    description: 'Fiber 1 Drop Wire Cable (SLT Auto Sync)',
                    category: 'DROP WIRE',
                    syncMode: 'AUTO',
                    terms: Array.from(f1Terms)
                });

                // G1 Row (Manual Entry)
                const g1Terms = new Set<string>(['G1', 'G-1', 'USED_G1']);
                companyItems.forEach(item => {
                    if (item.code) g1Terms.add(item.code.trim().toUpperCase());
                    if (item.sltCode) g1Terms.add(item.sltCode.trim().toUpperCase());
                    if (Array.isArray(item.importAliases)) {
                        item.importAliases.forEach(a => {
                            if (a && a.trim()) g1Terms.add(a.trim().toUpperCase());
                        });
                    }
                });

                resultColumns.push({
                    key: 'G1',
                    label: 'G1',
                    description: 'Indoor/Internal Fiber Cable (Contractor Manual Entry)',
                    category: 'DROP WIRE',
                    syncMode: 'MANUAL',
                    terms: Array.from(g1Terms)
                });

                return;
            }

            // Standard Categories: Consolidated into ONE column header row
            const combinedTerms = new Set<string>();
            let desc = '';

            groupItems.forEach(item => {
                if (!desc && item.description) desc = item.description;
                if (!desc && item.name) desc = item.name;

                // Add Item Code, SLT Code, and Admin/Settings importAliases
                if (item.code) combinedTerms.add(item.code.trim().toUpperCase());
                if (item.sltCode) combinedTerms.add(item.sltCode.trim().toUpperCase());
                if (Array.isArray(item.importAliases)) {
                    item.importAliases.forEach(a => {
                        if (a && a.trim()) combinedTerms.add(a.trim().toUpperCase());
                    });
                }
            });

            // If no terms were added from DB, add the category name as a term
            if (combinedTerms.size === 0) {
                combinedTerms.add(catName);
            }

            const label = catName;
            const key = catName.replace(/\s+/g, '-');

            resultColumns.push({
                key,
                label,
                description: desc || label,
                category: catName,
                syncMode: 'AUTO',
                terms: Array.from(combinedTerms)
            });
        });

        return resultColumns;
    }

    /**
     * Get active invoice material header mapping rules.
     * Merges live Admin/Settings importAliases with stored config.
     */
    static async getMappingConfig(): Promise<{ columns: MappingColumnDTO[]; isCustom: boolean }> {
        const config = await prisma.systemConfig.findUnique({
            where: { key: CONFIG_KEY },
            select: { value: true }
        });

        const dynamicMapping = await this.getDynamicDatabaseMapping();

        if (!config) {
            return { columns: dynamicMapping, isCustom: false };
        }

        try {
            const parsed: MappingColumnDTO[] = JSON.parse(config.value);
            
            // Sync live Admin/Settings importAliases into existing columns so aliases are always up to date
            const mergedColumns = parsed.map(col => {
                const dynamicMatch = dynamicMapping.find(d => 
                    d.key === col.key || 
                    (d.category && col.category && d.category.toUpperCase() === col.category.toUpperCase()) ||
                    d.label.toUpperCase() === col.label.toUpperCase()
                );

                if (dynamicMatch) {
                    const mergedTermsSet = new Set<string>([...col.terms, ...dynamicMatch.terms]);
                    return {
                        ...col,
                        terms: Array.from(mergedTermsSet)
                    };
                }
                return col;
            });

            return { columns: mergedColumns, isCustom: true };
        } catch {
            return { columns: dynamicMapping, isCustom: false };
        }
    }

    /**
     * Save updated invoice material header mapping rules
     */
    static async saveMappingConfig(columns: MappingColumnDTO[]): Promise<{ columns: MappingColumnDTO[] }> {
        await prisma.systemConfig.upsert({
            where: { key: CONFIG_KEY },
            update: { value: JSON.stringify(columns) },
            create: { key: CONFIG_KEY, value: JSON.stringify(columns) }
        });

        return { columns };
    }

    /**
     * Reset mapping rules dynamically from Admin Settings Active Common Categories (consolidated per category group)
     */
    static async resetToDefault(): Promise<{ columns: MappingColumnDTO[] }> {
        const dynamicMapping = await this.getDynamicDatabaseMapping();
        await prisma.systemConfig.upsert({
            where: { key: CONFIG_KEY },
            update: { value: JSON.stringify(dynamicMapping) },
            create: { key: CONFIG_KEY, value: JSON.stringify(dynamicMapping) }
        });

        return { columns: dynamicMapping };
    }
}
