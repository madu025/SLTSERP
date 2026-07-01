import { primaryClient as prisma } from '@/lib/prisma';
import { AssetCustodyService } from './inventory/asset-custody.service';
import { StockRequestService } from './inventory/stock-request.service';

export interface NexusAction {
    type: 'STOCK_HEAL' | 'STOCK_TRANSFER' | 'ASSIGN_CUSTODY';
    itemId?: string;
    itemCode?: string;
    itemName?: string;
    fromStoreId?: string;
    fromStoreName?: string;
    toStoreId?: string;
    toStoreName?: string;
    serialId?: string;
    serialNumber?: string;
    staffId?: string;
    staffName?: string;
    quantity?: number;
}

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
            custodyAssets,
            contractorsCount
        ] = await Promise.all([
            prisma.inventoryItem.count(),
            prisma.inventoryStore.count(),
            prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.user.count(),
            // Low stock check
            (prisma.inventoryStock as any).findMany({
                where: { quantity: { lte: 10 } }, // Simple low stock heuristic
                include: { item: true, store: true },
                take: 10
            }),
            // Expiring batches (within 30 days)
            (prisma.inventoryBatch as any).findMany({
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
            (prisma.inventoryItemSerial as any).findMany({
                where: { status: 'ASSIGNED' },
                include: { assignedStaff: true, item: true },
                take: 10
            }),
            prisma.contractor.count()
        ]);

        return {
            itemsCount,
            storesCount,
            projectsCount,
            activeUsersCount,
            contractorsCount,
            lowStock: lowStockItems.map((s: any) => ({
                itemName: s.item?.name || 'Unknown',
                itemCode: s.item?.code || '',
                storeName: s.store?.name || '',
                qty: Number(s.quantity),
                min: Number(s.minLevel)
            })),
            expiringBatches: expiringBatches.map((b: any) => ({
                batchNumber: b.batchNumber,
                itemName: b.item?.name || 'Unknown',
                expiry: b.expiryDate?.toLocaleDateString() || 'N/A'
            })),
            custodyAssets: custodyAssets.map((c: any) => ({
                serialNumber: c.serialNumber,
                itemName: c.item?.name || 'Unknown',
                staffName: c.assignedStaff?.name || 'Unknown'
            }))
        };
    }

    /**
     * Autonomous Stock Self-Healing: Search for stores with excess stock to cover low-stock stores
     */
    static async getSelfHealingProposals(): Promise<NexusAction[]> {
        const stocks = await prisma.inventoryStock.findMany({
            include: { item: true, store: true }
        });

        const lowStock = stocks.filter(s => Number(s.quantity) <= Number(s.minLevel));
        const proposals: NexusAction[] = [];

        for (const ls of lowStock) {
            const shortageQty = Math.ceil(Number(ls.minLevel) - Number(ls.quantity) + 10);
            
            // Find a store holding the same item with surplus stock
            const excessStock = stocks.find(s => 
                s.itemId === ls.itemId && 
                s.storeId !== ls.storeId && 
                Number(s.quantity) > (Number(s.minLevel) + shortageQty + 20)
            );

            if (excessStock) {
                proposals.push({
                    type: 'STOCK_HEAL',
                    itemId: ls.itemId,
                    itemCode: ls.item.code,
                    itemName: ls.item.name,
                    fromStoreId: excessStock.storeId,
                    fromStoreName: excessStock.store.name,
                    toStoreId: ls.storeId,
                    toStoreName: ls.store.name,
                    quantity: shortageQty
                });
            }
        }

        return proposals;
    }

    /**
     * Parse natural language ChatOps commands for writing/updating the database
     */
    static async parseChatOps(message: string): Promise<NexusAction | null> {
        const words = message.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").split(/\s+/).filter(Boolean);
        if (words.length === 0) return null;

        // 1. Search for a matching registered serial number
        const serials = await prisma.inventoryItemSerial.findMany({
            where: {
                serialNumber: { in: words }
            },
            include: { item: true }
        });

        // 2. Search for a matching staff member
        const staffList = await prisma.staff.findMany({
            where: {
                OR: [
                    { employeeId: { in: words } },
                    { name: { in: words } }
                ]
            }
        });

        if (serials.length > 0 && staffList.length > 0) {
            const serial = serials[0];
            const staff = staffList[0];
            return {
                type: 'ASSIGN_CUSTODY',
                serialId: serial.id,
                serialNumber: serial.serialNumber,
                itemName: serial.item.name,
                staffId: staff.id,
                staffName: staff.name
            };
        }

        // 3. Search for stock transfer commands (quantity, two stores, and item name/code)
        const numbers = words.map(w => parseFloat(w)).filter(n => !isNaN(n));
        const qty = numbers.find(n => n > 0);

        if (qty) {
            const stores = await prisma.inventoryStore.findMany();
            const matchedStores = [];
            for (const store of stores) {
                if (message.toLowerCase().includes(store.name.toLowerCase())) {
                    matchedStores.push(store);
                }
            }

            const items = await prisma.inventoryItem.findMany();
            let matchedItem = null;
            for (const item of items) {
                if (message.toLowerCase().includes(item.name.toLowerCase()) || message.toLowerCase().includes(item.code.toLowerCase())) {
                    matchedItem = item;
                    break;
                }
            }

            if (matchedStores.length >= 2 && matchedItem) {
                return {
                    type: 'STOCK_TRANSFER',
                    itemId: matchedItem.id,
                    itemCode: matchedItem.code,
                    itemName: matchedItem.name,
                    fromStoreId: matchedStores[0].id,
                    fromStoreName: matchedStores[0].name,
                    toStoreId: matchedStores[1].id,
                    toStoreName: matchedStores[1].name,
                    quantity: qty
                };
            }
        }

        return null;
    }

    /**
     * Execute an autonomous action on behalf of the user safely (with full ERP audit logging)
     */
    static async executeAction(action: NexusAction, userId: string) {
        if (action.type === 'ASSIGN_CUSTODY') {
            if (!action.serialNumber || !action.staffId) throw new Error("MISSING_PARAMS");
            return await AssetCustodyService.assignAsset(
                action.serialNumber,
                action.staffId,
                userId
            );
        }

        if (action.type === 'STOCK_HEAL' || action.type === 'STOCK_TRANSFER') {
            if (!action.itemId || !action.fromStoreId || !action.toStoreId || !action.quantity) {
                throw new Error("MISSING_PARAMS");
            }
            return await StockRequestService.createStockRequest({
                fromStoreId: action.toStoreId, // Target store requests it
                toStoreId: action.fromStoreId, // Source store issues it
                requestedById: userId,
                priority: 'HIGH',
                purpose: 'Autonomous self-healing stock replenishment via Nexus Agent',
                items: [{
                    itemId: action.itemId,
                    requestedQty: action.quantity,
                    remarks: 'Replenishment proposal accepted'
                }]
            });
        }

        throw new Error("UNKNOWN_ACTION_TYPE");
    }

    /**
     * Process user query using either Google Gemini 2.5 Flash API or intelligent pattern matching
     */
    static async ask(message: string): Promise<{ response: string; actions?: NexusAction[] }> {
        const context = await this.getSystemContext();
        const apiKey = process.env.GEMINI_API_KEY;

        // Run proactive analysis
        const selfHealing = await this.getSelfHealingProposals();
        const chatOps = await this.parseChatOps(message);

        // Formulate agent prompts
        const systemPrompt = `
You are "Nexus Agent", the intelligent global AI assistant of SLTS Nexus ERP.
Your task is to help the user manage inventory, track assets, see low stock, check expiring batches, and run database ChatOps.
You must be fully compatible with all ERP modules.

Current Live ERP Database Context:
- Total Items Registered: ${context.itemsCount}
- Active Stores: ${context.storesCount}
- Active Projects: ${context.projectsCount}
- Active Users: ${context.activeUsersCount}
- Low Stock Items detected: ${JSON.stringify(context.lowStock)}
- Expiring Batches (within 30 days): ${JSON.stringify(context.expiringBatches)}
- Serialized IT/Admin assets under staff custody: ${JSON.stringify(context.custodyAssets)}
- Self-Healing Virtual Stock Replenishment Proposals: ${JSON.stringify(selfHealing)}
- Identified ChatOps write action from user: ${chatOps ? JSON.stringify(chatOps) : 'None'}

Rules:
1. Always be polite, professional, and clear.
2. If the user asks in Sinhala, reply in natural Sinhala. If in English, reply in English.
3. If the user wants to assign a serial or transfer stock, and we parsed it, confirm details and tell them they can execute it with one click!
4. If there is a stock shortage, highlight the self-healing transfer proposal.
        `;

        const actions: NexusAction[] = [];
        if (chatOps) actions.push(chatOps);
        if (selfHealing.length > 0) actions.push(...selfHealing.slice(0, 2));

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
                                        { text: `User Question/Command: "${message}"` }
                                    ]
                                }
                            ]
                        })
                    }
                );

                if (response.ok) {
                    const json = await response.json();
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        return { response: text, actions };
                    }
                }
            } catch (err) {
                console.error("Gemini API call failed:", err);
            }
        }

        // --- FALLBACK: DYNAMIC CONTEXTUAL RESPONSE GENERATOR ---
        if (chatOps) {
            if (chatOps.type === 'ASSIGN_CUSTODY') {
                return {
                    response: `මට පෙනෙන විදිහට ඔබට අවශ්‍ය වන්නේ ${chatOps.itemName} (Serial: ${chatOps.serialNumber}) උපකරණය ${chatOps.staffName} හට පැවරීමටයි. පහත Confirm බොත්තම මඟින් ඔබට මෙය සෘජුවම සිදු කළ හැක.`,
                    actions
                };
            }
            if (chatOps.type === 'STOCK_TRANSFER') {
                return {
                    response: `මට පෙනෙන විදිහට ඔබට අවශ්‍ය වන්නේ ${chatOps.fromStoreName} සිට ${chatOps.toStoreName} දක්වා ${chatOps.quantity} ${chatOps.itemName} මාරු කිරීමටයි. පහත Confirm බොත්තම මඟින් මෙය සෘජුවම සිදු කළ හැක.`,
                    actions
                };
            }
        }

        const query = message.toLowerCase();

        // 1. Match contractors count queries
        if (query.includes('contractor') || query.includes('pravishtha') || query.includes('koththra') || query.includes('කොන්ත්‍රාත්')) {
            return {
                response: `පද්ධතියේ දැනට ලියාපදිංචි කොන්ත්‍රාත්කරුවන් (Contractors) **${context.contractorsCount}** දෙනෙකු සිටී.\n\nThere are currently **${context.contractorsCount}** contractors registered in the system.`,
                actions
            };
        }

        // 2. Match active projects count queries
        if (query.includes('project') || query.includes('wiyapa') || query.includes('ව්‍යාපෘති')) {
            return {
                response: `පද්ධතියේ දැනට ක්‍රියාත්මක සක්‍රීය ව්‍යාපෘති (Active Projects) **${context.projectsCount}** ක් ඇත.\n\nThere are currently **${context.projectsCount}** active projects in progress.`,
                actions
            };
        }

        // 3. Match users count queries
        if (query.includes('user') || query.includes('pariharaka') || query.includes('පරිශීලක')) {
            return {
                response: `පද්ධතියේ දැනට ලියාපදිංචි පරිශීලකයින් (Users) **${context.activeUsersCount}** දෙනෙකු සිටී.\n\nThere are currently **${context.activeUsersCount}** registered users on the platform.`,
                actions
            };
        }

        // 4. Match stores count queries
        if (query.includes('store') || query.includes('gabad') || query.includes('ගබඩා')) {
            return {
                response: `පද්ධතියේ දැනට සක්‍රීය ගබඩා (Active Stores) **${context.storesCount}** ක් ඇත.\n\nThere are currently **${context.storesCount}** active stores configured.`,
                actions
            };
        }

        // 5. Match items count queries
        if (query.includes('item') || query.includes('bada') || query.includes('උපකරණ') || query.includes('භාණ්ඩ')) {
            return {
                response: `පද්ධතියේ දැනට ලියාපදිංචි භාණ්ඩ/උපකරණ වර්ග (Inventory Items) **${context.itemsCount}** ක් ඇත.\n\nThere are currently **${context.itemsCount}** registered inventory items.`,
                actions
            };
        }

        if (query.includes('low') || query.includes('stok') || query.includes('adu') || query.includes('stock')) {
            if (context.lowStock.length === 0) {
                return { response: `ගබඩාවේ දැනට අවම සීමාවට වඩා අඩු වූ (Low Stock) කිසිදු උපකරණයක් නොමැත.`, actions };
            }
            const itemsList = context.lowStock
                .map((s: any) => `- ${s.itemName} (${s.itemCode}) in ${s.storeName}: Current ${s.qty} (Min Limit: ${s.min})`)
                .join('\n');
            
            let selfHealText = '';
            if (selfHealing.length > 0) {
                selfHealText = `\n\n💡 **ස්වයං-සුවපත් කිරීමේ යෝජනාව (Self-Healing Proposal):**\n` + 
                    selfHealing.map(p => `- ${p.fromStoreName} හි අතිරික්තයෙන් ${p.quantity} ක් ${p.toStoreName} වෙත මාරු කර ${p.itemName} හිඟය පියවිය හැක.`).join('\n');
            }

            return {
                response: `දැනට පද්ධතියේ හඳුනාගත් අවම මට්ටමේ පවතින උපකරණ ලැයිස්තුව (Low Stock):\n\n${itemsList}${selfHealText}`,
                actions
            };
        }

        if (query.includes('expire') || query.includes('expiry') || query.includes('kalkuth') || query.includes('date')) {
            if (context.expiringBatches.length === 0) {
                return { response: `ඉදිරි දින 30ක් ඇතුළත කල් ඉකුත්වීමට ආසන්න කිසිදු batch එකක් නොමැත.`, actions };
            }
            const expiringList = context.expiringBatches
                .map((b: any) => `- Batch ${b.batchNumber}: ${b.itemName} (Expiry Date: ${b.expiry})`)
                .join('\n');
            return {
                response: `කල් ඉකුත්වීමට ආසන්න batches ලැයිස්තුව:\n\n${expiringList}`,
                actions
            };
        }

        return {
            response: `ආයුබෝවන්! මම **Nexus Agent**, ඔබගේ සහය සහායකයා. 

මගෙන් ඔබට:
1. **අඩු තොග අනතුරු ඇඟවීම් සහ ස්වයං-සුවපත් කිරීමේ මාරු කිරීම් (Self-Healing Transfers)**
2. **කල් ඉකුත්වන ද්‍රව්‍ය (Batch Expiry/FEFO Warnings)**
3. **සෘජු විධාන මඟින් ගනුදෙනු කිරීම් (ChatOps Assignment & Transfers)**
පිළිබඳව live තොරතුරු ලබාගෙන ඒවා සෘජුවම ක්‍රියාත්මක කළ හැක.

ඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?`,
            actions
        };
    }
}
