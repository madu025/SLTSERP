/**
 * Master Dictionary of Standard SLT Clarity / CRM Scraped Raw Material Names.
 * Mapped to OSP/FTTH Common Category Names.
 *
 * NOTE: Domain reference only — NOT wired into any auto-seeding.
 * Aliases are managed manually via Admin → Settings → Material Assignment
 * (5-column table). Do not auto-populate item alias arrays from this file.
 */
export const DEFAULT_SLT_SCRAPED_ALIASES: Record<string, string[]> = {
    "Drop Wire Cable": [
        "DWIRE",
        "DROP WIRE",
        "DROP WIRE 2 CORE",
        "2C DROP WIRE",
        "DW",
        "GRID_MATERIAL",
        "DROP WIRE 2 CORE (COPPER CLAD)"
    ],
    "Rosette ATB Box": [
        "ROSETTE",
        "ATB",
        "OPTICAL ROSETTE",
        "TABLE_MAT",
        "ROSETTE BOX",
        "ATB BOX"
    ],
    "Fast Connector": [
        "FAST CONNECTOR",
        "FAC",
        "FAC CONNECTOR",
        "SC/APC",
        "CONNECTOR",
        "FIELD ASSEMBLY CONNECTOR"
    ],
    "Poles": [
        "POLES",
        "NUMBER OF POLES",
        "POLE 8.3M",
        "POLE 5.6M",
        "CONCRETE POLE",
        "GI POLE"
    ],
    "ONT Router Unit": [
        "ONT",
        "ONT ROUTER",
        "GPON ONT",
        "CPE",
        "ROUTER",
        "ONU",
        "WIFI ONT"
    ],
    "Splitter & FAT": [
        "FAT",
        "FDB",
        "SPLITTER 1:8",
        "SPLITTER 1:4",
        "SPLITTER 1:16",
        "OPTICAL SPLITTER"
    ],
    "Fiber Cable": [
        "FIBER CABLE",
        "2 CORE CABLE",
        "4 CORE CABLE",
        "8 CORE CABLE",
        "12 CORE CABLE",
        "FO CABLE"
    ],
    "Splicing Sleeves & Hardware": [
        "SPLICING SLEEVE",
        "PROTECTION SLEEVE",
        "HOOK C",
        "HOOK L",
        "BOLT & NUTS",
        "C-HOOK",
        "L-HOOK"
    ]
};

/**
 * Normalizes a raw material name/code for fuzzy alias matching.
 * Converts to uppercase, trims whitespace, and collapses multiple spaces/underscores.
 */
export function normalizeMaterialName(name: string): string {
    if (!name) return "";
    return name
        .toUpperCase()
        .trim()
        .replace(/[\s_-]+/g, " ");
}

/**
 * Returns default SLT scraped aliases for a given common category name or item name.
 */
export function getDefaultAliasesForCategory(categoryOrItemName: string): string[] {
    if (!categoryOrItemName) return [];
    
    const normalizedInput = normalizeMaterialName(categoryOrItemName);

    for (const [categoryKey, aliases] of Object.entries(DEFAULT_SLT_SCRAPED_ALIASES)) {
        const normKey = normalizeMaterialName(categoryKey);
        if (normalizedInput.includes(normKey) || normKey.includes(normalizedInput)) {
            return aliases;
        }
    }

    // Secondary keyword matching
    if (normalizedInput.includes("DROP WIRE") || normalizedInput.includes("DWIRE")) return DEFAULT_SLT_SCRAPED_ALIASES["Drop Wire Cable"];
    if (normalizedInput.includes("ROSETTE") || normalizedInput.includes("ATB")) return DEFAULT_SLT_SCRAPED_ALIASES["Rosette ATB Box"];
    if (normalizedInput.includes("FAST CONNECTOR") || normalizedInput.includes("FAC")) return DEFAULT_SLT_SCRAPED_ALIASES["Fast Connector"];
    if (normalizedInput.includes("POLE")) return DEFAULT_SLT_SCRAPED_ALIASES["Poles"];
    if (normalizedInput.includes("ONT") || normalizedInput.includes("CPE") || normalizedInput.includes("ROUTER")) return DEFAULT_SLT_SCRAPED_ALIASES["ONT Router Unit"];
    if (normalizedInput.includes("FAT") || normalizedInput.includes("SPLITTER")) return DEFAULT_SLT_SCRAPED_ALIASES["Splitter & FAT"];
    if (normalizedInput.includes("FIBER") || normalizedInput.includes("CABLE")) return DEFAULT_SLT_SCRAPED_ALIASES["Fiber Cable"];

    return [];
}

/**
 * Normalizes common category names to detect & merge duplicate variants
 * (e.g. "Bolt & Nut" vs "Bolt & Nuts", "CAT 5E" vs "Cable CAT5E", "Drop Wire Retainer" vs "DW-RT").
 */
export function getCanonicalCategoryName(cName: string, existingCategories: string[]): string {
    if (!cName) return "";
    const clean = cName.trim();
    
    // Check exact case-insensitive match
    const existingMatch = existingCategories.find(cat => cat.toLowerCase() === clean.toLowerCase());
    if (existingMatch) return existingMatch;

    // Check singular vs plural match (e.g. "Bolt & Nuts" vs "Bolt & Nut")
    const normKey = clean.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const cat of existingCategories) {
        const catNormKey = cat.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normKey === catNormKey || normKey === catNormKey + "s" || normKey + "s" === catNormKey) {
            return cat;
        }
    }

    // Domain equivalence checks
    const upperClean = clean.toUpperCase();

    // CAT 5E / Cable CAT5E equivalence
    if (upperClean.includes("CAT 5E") || upperClean.includes("CAT5E")) {
        const cat5eCat = existingCategories.find(cat => {
            const u = cat.toUpperCase();
            return u.includes("CAT 5E") || u.includes("CAT5E");
        });
        if (cat5eCat) return cat5eCat;
    }

    // Drop Wire Retainer / DW-RT equivalence
    if (upperClean.includes("DROP WIRE RETAINER") || upperClean.includes("DW-RT") || upperClean.includes("DW RETAINER")) {
        const dwRetainerCat = existingCategories.find(cat => {
            const u = cat.toUpperCase();
            return u.includes("RETAINER") || u.includes("DW-RT");
        });
        if (dwRetainerCat) return dwRetainerCat;
    }

    // Conduit Pipe Clip / Clip 5/8 equivalence
    if (upperClean.includes("CONDUIT PIPE CLIP") || upperClean.includes("PIPE CLIP")) {
        const clipCat = existingCategories.find(cat => {
            const u = cat.toUpperCase();
            return u.includes("CONDUIT PIPE CLIP") || u.includes("PIPE CLIP");
        });
        if (clipCat) return clipCat;
    }

    return clean;
}
