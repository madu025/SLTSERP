import { primaryClient as prisma } from '@/lib/prisma';

export class NexusAgentService {
    /**
     * Gather real-time system context/metrics for the AI engine
     */
    static async getSystemContext() {
        const [
            itemsCount,
            storesCount,
            projectsCount,
            activeUsersCount,
            lowStockItems,
            expiringBatches,
            custodyAssets
        ] = await Promise.all([
            prisma.inventoryItem.count(),
            prisma.inventoryStore.count(),
            prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.user.count(),
            // Low stock check
            prisma.inventoryStock.findMany({
                where: { quantity: { lte: 10 } }, // Simple low stock heuristic
                include: { item: true, store: true },
                take: 10
            }),
            // Expiring batches (within 30 days)
            prisma.inventoryBatch.findMany({
                where: {
                    expiryDate: {
                        lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        gt: new Date()
                    }
                },
                include: { item: true },
                take: 10
            }),
            // Serial custody assets
            prisma.inventoryItemSerial.findMany({
                where: { status: 'ASSIGNED' },
                include: { assignedStaff: true, item: true },
                take: 10
            })
        ]);

        return {
            itemsCount,
            storesCount,
            projectsCount,
            activeUsersCount,
            lowStock: lowStockItems.map(s => ({
                itemName: s.item.name,
                itemCode: s.item.code,
                storeName: s.store.name,
                qty: Number(s.quantity),
                min: Number(s.minLevel)
            })),
            expiringBatches: expiringBatches.map(b => ({
                batchNumber: b.batchNumber,
                itemName: b.item.name,
                expiry: b.expiryDate?.toLocaleDateString()
            })),
            custodyAssets: custodyAssets.map(c => ({
                serialNumber: c.serialNumber,
                itemName: c.item.name,
                staffName: c.assignedStaff?.name || 'Unknown'
            }))
        };
    }

    /**
     * Process user query using either Google Gemini API or intelligent pattern matching
     */
    static async ask(message: string): Promise<string> {
        const context = await this.getSystemContext();
        const apiKey = process.env.GEMINI_API_KEY;

        const systemPrompt = `
You are "Nexus Agent", the intelligent global AI assistant of SLTS Nexus ERP.
Your task is to help the user manage inventory, track assets, see low stock, check expiring batches, and understand the system.
You must be fully compatible with all ERP modules.
Current Live ERP Database Context:
- Total Items Registered: ${context.itemsCount}
- Active Stores: ${context.storesCount}
- Active Projects: ${context.projectsCount}
- Active Users: ${context.activeUsersCount}
- Low Stock Items detected: ${JSON.stringify(context.lowStock)}
- Expiring Batches (within 30 days): ${JSON.stringify(context.expiringBatches)}
- Serialized IT/Admin assets under staff custody: ${JSON.stringify(context.custodyAssets)}

Rules:
1. Always be polite, professional, and clear.
2. If the user asks in Sinhala, reply in natural Sinhala. If in English, reply in English.
3. Use the Live ERP Context above to answer questions about stock level, expiring batches, and asset custody.
4. If a question is outside ERP context, politely guide the user back.
        `;

        if (apiKey) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [
                                {
                                    role: 'user',
                                    parts: [
                                        { text: systemPrompt },
                                        { text: `User Question: "${message}"` }
                                    ]
                                }
                            ]
                        })
                    }
                );

                if (response.ok) {
                    const json = await response.json();
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return text;
                }
            } catch (err) {
                console.error("Gemini API call failed:", err);
            }
        }

        // --- FALLBACK: INTELLIGENT RULE-BASED NATURAL LANGUAGE HANDLER ---
        const query = message.toLowerCase();

        if (query.includes('low') || query.includes('stok') || query.includes('adu') || query.includes('stock')) {
            if (context.lowStock.length === 0) {
                return `ගබඩාවේ දැනට අවම සීමාවට වඩා අඩු වූ (Low Stock) කිසිදු උපකරණයක් නොමැත. (No low stock items found).`;
            }
            const itemsList = context.lowStock
                .map(s => `- ${s.itemName} (${s.itemCode}) in ${s.storeName}: Current ${s.qty} (Min Limit: ${s.min})`)
                .join('\n');
            return `දැනට පද්ධතියේ හඳුනාගත් අවම මට්ටමේ පවතින උපකරණ ලැයිස්තුව මෙසේය (Low Stock Items):\n\n${itemsList}\n\nකරුණාකර මේවා සඳහා නව Purchase Request එකක් හෝ virtual transfer එකක් සිදු කරන්න.`;
        }

        if (query.includes('expire') || query.includes('expiry') || query.includes('kalkuth') || query.includes('date')) {
            if (context.expiringBatches.length === 0) {
                return `ඉදිරි දින 30ක් ඇතුළත කල් ඉකුත්වීමට ආසන්න කිසිදු batch එකක් හඳුනාගෙන නොමැත. (No expiring batches found).`;
            }
            const expiringList = context.expiringBatches
                .map(b => `- Batch ${b.batchNumber}: ${b.itemName} (Expiry Date: ${b.expiry})`)
                .join('\n');
            return `කල් ඉකුත්වීමට ආසන්න batches ලැයිස්තුව (Expiring soon):\n\n${expiringList}\n\nFEFO නීතියට අනුව, මෙම batches පළමුවෙන්ම නිකුත් කිරීමට (Stock Issue) පියවර ගන්න.`;
        }

        if (query.includes('custody') || query.includes('bhara') || query.includes('assign') || query.includes('laptop') || query.includes('serial')) {
            if (context.custodyAssets.length === 0) {
                return `දැනට සේවකයින්ට පවරා ඇති (Assigned) කිසිදු IT/Admin serialized උපකරණයක් නොමැත. (No serialized assets assigned).`;
            }
            const custodyList = context.custodyAssets
                .map(c => `- Serial ${c.serialNumber}: ${c.itemName} -> Assigned to: ${c.staffName}`)
                .join('\n');
            return `දැනට සේවකයින් භාරයේ පවතින උපකරණ සහ සන්තකය (Asset Custody Directory):\n\n${custodyList}\n\nනව මාරුවීමක් සිදුකිරීමට "Asset Custody" UI පිටුව භාවිතා කරන්න.`;
        }

        return `ආයුබෝවන්! මම **Nexus Agent**, ඔබගේ සහය සහායකයා. 

මගෙන් ඔබට:
1. **අඩු තොග අනතුරු ඇඟවීම් (Low Stock Alerts)**
2. **කල් ඉකුත්වන ද්‍රව්‍ය (Batch Expiry/FEFO Warnings)**
3. **සේවක වත්කම් සන්තකය (Asset Custody/Laptop Handovers)**
පිළිබඳව live තොරතුරු ලබාගත හැක.

ඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?`;
    }
}
