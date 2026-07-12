import { primaryClient as prisma } from '@/lib/prisma';
import { AssetCustodyService } from './inventory/asset-custody.service';
import { StockRequestService } from './inventory/stock-request.service';
import { NexusContextService } from './nexus-context.service';
import { NexusClassifierService } from './nexus-classifier.service';

interface GeminiResponse {
    candidates?: {
        content?: {
            parts?: {
                text?: string;
            }[];
        };
    }[];
}

// Trigger background model training asynchronously on load
NexusClassifierService.train().then(() => {
    // Start continuous retraining loop every 1 hour (3600000 ms)
    NexusClassifierService.startContinuousTraining(3600000);
}).catch(err => {
    console.error("[CLASSIFIER-INIT] Background model training failed:", err);
});

export interface NexusAction {
    type: 'STOCK_HEAL' | 'STOCK_TRANSFER' | 'ASSIGN_CUSTODY' | 'CREATE_USER' | 'EXPORT_EXCEL';
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
    // User creation params
    username?: string;
    password?: string;
    role?: string;
    rtomCode?: string;
    opmcId?: string;
    // Excel export params
    reportType?: string;
    reportData?: string; // stringified JSON array
    fileName?: string;
}

export interface NexusResponse {
    response: string;
    actions?: NexusAction[];
    intent?: string;
    query?: string;
    suggestions?: string[];
}

export class NexusAgentService {
    // In-memory query response cache
    private static queryCache = new Map<string, { response: NexusResponse; timestamp: number }>();
    private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

    /**
     * Intelligent AI Model Router: Dynamically selects the best model based on Role, Query Complexity, and Data Volume.
     */
    static selectAIModel(message: string, contextData: Record<string, unknown>, userRole: string): string {
        // 1. Role Priority Check
        const isPowerUser = [
            'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER', 
            'FINANCE_MANAGER', 'INVOICE_MANAGER', 'STORES_MANAGER', 'SA_MANAGER'
        ].includes(userRole);
        if (isPowerUser) return 'gemini-3.5-flash';

        // 2. Query Complexity Check (Excel export, Audits, Forecasts, Reports)
        const msgLower = message.toLowerCase();
        const complexKeywords = [
            'report', 'excel', 'export', 'sheet', 'audit', 'reconcile',
            'forecast', 'optimize', 'ld penalty', 'retention', 'mismatch',
            'summary', 'xlsx', 'csv', 'download', 'downlaod', 'exel', 'excl',
            'විශ්ලේෂණය', 'වාර්තාව', 'සංසන්දනය'
        ];
        if (complexKeywords.some(kw => msgLower.includes(kw))) {
            return 'gemini-3.5-flash';
        }

        // 3. Context Data Volume Check (Targeted for heavy reporting/Excel limits)
        // If context size exceeds 12000 characters, route to 3.5 Flash to ensure attention accuracy over larger contexts.
        const contextStr = JSON.stringify(contextData);
        if (contextStr.length > 12000) {
            return 'gemini-3.5-flash';
        }

        // Default to cost-efficient model for normal simple queries
        return 'gemini-2.5-flash-lite';
    }

    /**
     * Unified system context helper
     */
    static async getSystemContext() {
        return NexusContextService.getContext();
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
     * Execute an autonomous action on behalf of the user safely
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

        if (action.type === 'CREATE_USER') {
            throw new Error("SECURITY_VIOLATION: Direct user creation via AI is disabled for security reasons. Please register new users manually through the User Management Dashboard.");
        }

        throw new Error("UNKNOWN_ACTION_TYPE");
    }

    /**
     * Lookup Database details for Gemini Function Call arguments to map string inputs to relational DB IDs
     */
    static async lookupAssetCustody(serialNumber: string, staffNameOrCode: string): Promise<NexusAction | null> {
        try {
            const serial = await prisma.inventoryItemSerial.findFirst({
                where: { serialNumber: { equals: serialNumber, mode: 'insensitive' } },
                include: { item: true }
            });

            if (!serial) return null;

            const staff = await prisma.staff.findFirst({
                where: {
                    OR: [
                        { employeeId: { equals: staffNameOrCode, mode: 'insensitive' } },
                        { name: { contains: staffNameOrCode, mode: 'insensitive' } }
                    ]
                }
            });

            if (!staff) return null;

            return {
                type: 'ASSIGN_CUSTODY',
                serialId: serial.id,
                serialNumber: serial.serialNumber,
                itemName: serial.item.name,
                staffId: staff.id,
                staffName: staff.name
            };
        } catch (e) {
            console.error("Lookup asset custody failed:", e);
            return null;
        }
    }

    static async lookupStockTransfer(itemCodeOrName: string, fromStoreName: string, toStoreName: string, quantity: number): Promise<NexusAction | null> {
        try {
            const item = await prisma.inventoryItem.findFirst({
                where: {
                    OR: [
                        { code: { equals: itemCodeOrName, mode: 'insensitive' } },
                        { name: { contains: itemCodeOrName, mode: 'insensitive' } }
                    ]
                }
            });

            if (!item) return null;

            const fromStore = await prisma.inventoryStore.findFirst({
                where: { name: { contains: fromStoreName, mode: 'insensitive' } }
            });

            const toStore = await prisma.inventoryStore.findFirst({
                where: { name: { contains: toStoreName, mode: 'insensitive' } }
            });

            if (!fromStore || !toStore) return null;

            return {
                type: 'STOCK_TRANSFER',
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                fromStoreId: fromStore.id,
                fromStoreName: fromStore.name,
                toStoreId: toStore.id,
                toStoreName: toStore.name,
                quantity: quantity
            };
        } catch (e) {
            console.error("Lookup stock transfer failed:", e);
            return null;
        }
    }

    static async lookupCreateUser(username: string, name: string, password: string, role: string, rtomCode?: string): Promise<NexusAction | null> {
        try {
            let opmcId = undefined;
            if (rtomCode) {
                const opmc = await prisma.oPMC.findFirst({
                    where: {
                        OR: [
                            { rtom: { equals: rtomCode, mode: 'insensitive' } },
                            { name: { contains: rtomCode, mode: 'insensitive' } }
                        ]
                    }
                });
                if (opmc) {
                    opmcId = opmc.id;
                }
            }

            // Normalize Role to match Prisma Role enum
            let normalizedRole = 'ENGINEER';
            const upperRole = role.toUpperCase();
            if (upperRole.includes('ADMIN')) {
                normalizedRole = 'ADMIN';
            } else if (upperRole.includes('MANAGER')) {
                normalizedRole = 'STORES_MANAGER'; // or OPMC_MANAGER/etc depending on context, using STORES_MANAGER as safe fallback
            }

            return {
                type: 'CREATE_USER',
                username,
                itemName: name,
                password,
                role: normalizedRole,
                rtomCode,
                opmcId
            };
        } catch (e) {
            console.error("Lookup create user failed:", e);
            return null;
        }
    }

    /**
     * Process user query using Google Gemini API or fallback matching
     */
    static async ask(message: string, userId: string): Promise<NexusResponse> {
        const cacheKey = `${userId}:${message.trim().toLowerCase()}`;
        const msgLower = message.toLowerCase();
        const isForceRefresh = msgLower.includes('refresh') || msgLower.includes('update') || msgLower.includes('නැවත') || msgLower.includes('aluth') || msgLower.includes('reload');
        
        if (!isForceRefresh) {
            const cached = this.queryCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
                console.log(`[CACHE-HIT] Returning cached response for query: "${message}"`);
                return cached.response;
            }
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const { NexusMemoryService } = await import('./nexus-memory.service');

        // Fetch user name and role to personalize AI greetings and enforce role security
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, role: true }
        });
        const userName = user?.name || "User";
        const userRole = user?.role || "ENGINEER";

        // 1. Predictive Intent Classification
        const intent = NexusClassifierService.predict(message);
        const actions: NexusAction[] = [];

        // Enforce Role-Based Information Hiding
        const hasFinanceAccess = [
            'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 
            'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 
            'INVOICE_MANAGER', 'INVOICE_ASSISTANT'
        ].includes(userRole);

        if ((intent === 'FINANCE' || intent === 'BOM_INVOICES' || intent === 'VOUCHERS') && !hasFinanceAccess) {
            return {
                intent,
                query: message,
                response: `⚠️ Unauthorized: Your role (${userRole}) is not authorized to access financial or billing reports. This query has been blocked for security.`,
                actions: [],
                suggestions: ["Show active projects status", "List current low stock items"]
            };
        }
        
        // 2. Fetch Modular Context (Only what is needed!)
        let contextText = '';
        let selfHealText = '';
        
        switch(intent) {
            case 'FINANCE': {
                const fin = await NexusContextService.getFinanceContext();
                contextText = `Outstanding Invoices Sum: LKR ${fin.outstandingInvoicesSum.toLocaleString()}\nPending PVs Count: ${fin.pendingPVsCount}\n`;
                if (fin.outstandingInvoicesList && fin.outstandingInvoicesList.length > 0) {
                    contextText += `Outstanding Invoices List:\n` + fin.outstandingInvoicesList.map(i => `- Invoice: ${i.invoiceNumber} | Amount: LKR ${i.totalAmount.toLocaleString()} | Status: ${i.status}`).join('\n');
                }
                if (fin.releasableInvoicesList && fin.releasableInvoicesList.length > 0) {
                    contextText += `\nReleasable Retention Invoices:\n` + fin.releasableInvoicesList.join('\n');
                }
                break;
            }
            case 'PROJECTS': {
                const proj = await NexusContextService.getProjectsContext();
                contextText = `Active Projects Count: ${proj.activeProjectsCount}\nOverdue Tasks Count: ${proj.overdueTasksCount}\n`;
                if (proj.activeProjectsList && proj.activeProjectsList.length > 0) {
                    contextText += `Active Projects List:\n` + proj.activeProjectsList.map(p => `- ${p.name} | Project Code: ${p.projectCode} | Progress: ${p.progress}%`).join('\n');
                }
                if (proj.projectRisks && proj.projectRisks.length > 0) {
                    contextText += `\nHigh Risk Projects:\n` + proj.projectRisks.map(p => `- ${p.name}: ${p.risks.join(', ')}`).join('\n');
                }
                break;
            }
            case 'INVENTORY_LOW': {
                const low = await NexusContextService.getInventoryLowStockContext();
                if (low.lowStock.length > 0) {
                    contextText = `Low Stock detected:\n` + low.lowStock.map(s => `- ${s.itemName} (${s.itemCode}) in ${s.storeName}: Current ${s.qty} (Min: ${s.min})`).join('\n');
                    const selfHealing = await this.getSelfHealingProposals();
                    if (selfHealing.length > 0) {
                        actions.push(...selfHealing.slice(0, 2));
                        selfHealText = `\n\n💡 **ස්වයං-සුවපත් කිරීමේ යෝජනාව (Self-Healing Proposal):**\n` + 
                            selfHealing.map(p => `- ${p.fromStoreName} හි අතිරික්තයෙන් ${p.quantity} ක් ${p.toStoreName} වෙත මාරු කර ${p.itemName} හිඟය පියවිය හැක.`).join('\n');
                    }
                } else {
                    contextText = "No low stock items detected.";
                }
                break;
            }
            case 'CONTRACTORS': {
                const cont = await NexusContextService.getContractorsContext();
                contextText = `Registered Contractors Count: ${cont.contractorsCount}\n`;
                if (cont.contractorsList && cont.contractorsList.length > 0) {
                    contextText += `Contractors List:\n` + cont.contractorsList.map(c => `- ${c.name} | Type: ${c.type}`).join('\n');
                }
                break;
            }
            case 'STORES': {
                const stores = await NexusContextService.getStoresContext();
                contextText = `Active Stores Count: ${stores.storesCount}\n`;
                if (stores.list && stores.list.length > 0) {
                    contextText += `Stores List:\n` + stores.list.map(s => `- ${s}`).join('\n');
                }
                break;
            }
            case 'INVENTORY_ITEMS': {
                const items = await NexusContextService.getInventoryItemsContext();
                contextText = `Total Inventory Items: ${items.itemsCount}\n`;
                if (items.itemsList && items.itemsList.length > 0) {
                    contextText += `Items List (top 20):\n` + items.itemsList.map(i => `- ${i.name} [${i.code}] | Unit: ${i.unit}`).join('\n');
                }
                break;
            }
            case 'PROCUREMENT': {
                const proc = await NexusContextService.getProcurementContext();
                contextText = `Pending PRs: ${proc.pendingPRsCount}\nPending POs: ${proc.pendingPOsCount}\nPending GRNs: ${proc.pendingGRNsCount}\n`;
                if (proc.pendingPOList && proc.pendingPOList.length > 0) {
                    contextText += `Pending Purchase Orders List:\n` + proc.pendingPOList.map(p => `- PO: ${p.poNumber} | Amount: LKR ${p.totalAmount.toLocaleString()} | Status: ${p.status}`).join('\n');
                }
                break;
            }
            case 'VOUCHERS': {
                const vouchers = await NexusContextService.getVouchersContext();
                contextText = `Pending PVs Count: ${vouchers.pendingPVsCount}\n`;
                if (vouchers.pendingVouchersList && vouchers.pendingVouchersList.length > 0) {
                    contextText += `Pending Payment Vouchers List:\n` + vouchers.pendingVouchersList.map(v => `- PV: ${v.pvNumber} | Payee: ${v.payeeName} | Amount: LKR ${v.amount.toLocaleString()} | Status: ${v.status}`).join('\n');
                }
                break;
            }
            case 'BOM_INVOICES': {
                const bom = await NexusContextService.getBOMInvoicesContext();
                const rtomMismatchSummary = bom.rtomMismatches && bom.rtomMismatches.length > 0
                    ? `\nRTOM Mismatch Stats:\n` + bom.rtomMismatches.map(m => `- RTOM ${m.rtom}: Mismatched Connections: ${m.mismatchedSODs}/${m.totalSODs} (Accuracy: ${m.accuracyRate}%) | Top Mismatched Material: ${m.topMismatchedItem}`).join('\n')
                    : `\nRTOM Mismatch Stats: All balanced.`;
                contextText = `BOM Invoices Count: ${bom.bomInvoicesCount}\nTotal Revenue from BOM: LKR ${bom.bomRevenueSum.toLocaleString()}\nTotal Synced Connections: ${bom.syncedSODsCount}\nRecent BOM Invoices:\n` + bom.recentBOMInvoices.join('\n') + rtomMismatchSummary;
                break;
            }
            default:
                contextText = "General queries mapping context.";
                break;
        }

        // 3. Gemini Generation (if API key available)
        if (apiKey) {
            const history = await NexusMemoryService.getConversation(userId);
            
            // Fetch targeted context to minimize token cost
            let contextData: Record<string, unknown>;
            if (intent !== 'UNKNOWN') {
                contextData = {
                    intent,
                    details: contextText
                };
            } else {
                const summary = await NexusContextService.getSummaryContext();
                if (!hasFinanceAccess) {
                    summary.finance = { pendingPVsCount: 0 };
                }
                contextData = summary as unknown as Record<string, unknown>;
            }
            
            const selfHealing = await this.getSelfHealingProposals();
            let healingPrompt = '';
            if (selfHealing.length > 0) {
                healingPrompt = `\n💡 Stock Self-Healing Recommendations:\n` + 
                    selfHealing.map(p => `- Transfer ${p.quantity} of ${p.itemName} from ${p.fromStoreName} to ${p.toStoreName}`).join('\n');
            }

            const systemPrompt = `You are "Nexus Agent", the intelligent global AI assistant of SLTS Nexus ERP.
Your task is to answer the user's question accurately using the complete live ERP system context provided below.
Since you have a unified, cross-functional view of the entire ERP (Inventory, Projects, Finance, Procurement, Contractors), you can answer complex cross-module queries.

CRITICAL INSTRUCTION:
1. PERSONALIZED GREETING: You MUST greet the user by their name: ${userName} in the beginning of your response. (e.g. "Hello ${userName}!", "Good morning ${userName}!", "ආයුබෝවන් ${userName}!").
2. LANGUAGE DYNAMICS: Answer in the language of the user's choice. If they ask in Sinhala, respond in natural Sinhala. If they ask in English, respond in English. If they ask in Singlish (Sinhala written in English letters, e.g. "gabadu gana kiyada"), respond in natural Sinhala or Singlish.
3. Your response MUST be a valid JSON object matching the following structure:
{
  "reply": "Your natural language response here...",
  "actions": [
     // Include actions here if applicable (e.g. EXPORT_EXCEL), or leave empty if none
  ],
  "suggestions": [
     "A relevant follow-up question the user might want to ask next based on your reply",
     "Another relevant follow-up question",
     "A third relevant follow-up question"
  ]
}
4. IMPORTANT: In your "reply" text, DO NOT wrap numbers or values in double asterisks (**). Output clean, plain numbers and text to maintain a professional look.
5. REDIRECTION LINKS: When mentioning projects, reports, stock levels, or vehicles, always provide markdown-style links so the user can navigate to them directly.
   - For Projects: [Project Code or Name](/projects/ProjectID) (e.g., "... can view the [Project Details](/projects/cldn9018401) ...")
   - For Reports: [Executive Reports](/reports/manager) or [Area Performance](/reports/arm)
   - For National GIS Map: [National GIS Map](/gis/map)
   - For Inventory Stock: [Stock Levels](/inventory/stock)
   - For Vehicles: [Vehicle Details](/vehicles/VehicleID)
   This is critical to let the user navigate directly to resources.
6. EXCEL EXPORT ACTION: If the user requests an Excel download, spreadsheet, or report export (e.g., "export finance report to excel" or "give me stores report in spreadsheet"), you can add an action in the "actions" array of type "EXPORT_EXCEL".
   - Set "reportType" (e.g., "FINANCE", "PROJECTS", "STORES", "INVENTORY").
   - Set "fileName" (e.g., "Finance_Report.csv").
   - Set "reportData" as a stringified JSON array containing rows of key-value data corresponding to the relevant items in the live system context (e.g., recent invoices, low-stock lists, or active projects). Format it as a valid JSON string inside the JSON property.
Do not return any markdown wrapping or other text outside this JSON object.

Complete Live ERP System Context:
${JSON.stringify(contextData, null, 2)}
${healingPrompt}
`;
            try {
                // Determine optimal model dynamically using the Intelligent Model Router
                const modelName = NexusAgentService.selectAIModel(message, contextData, userRole);

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system_instruction: { parts: [{ text: systemPrompt }] },
                            contents: [
                                ...history,
                                { role: 'user', parts: [{ text: message }] }
                            ],
                            generationConfig: {
                                responseMimeType: 'application/json'
                            }
                        })
                    }
                );
                
                if (response.ok) {
                    const data = (await response.json()) as GeminiResponse;
                    const textReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";
                    
                    let parsedReply = textReply;
                    let suggestions: string[] = [
                        "Show active projects status",
                        "List current low stock items",
                        "What is our outstanding invoice sum?"
                    ];
                    
                    try {
                        const firstBrace = textReply.indexOf('{');
                        const lastBrace = textReply.lastIndexOf('}');
                        if (firstBrace !== -1 && lastBrace !== -1) {
                            const jsonStr = textReply.substring(firstBrace, lastBrace + 1);
                            const parsed = JSON.parse(jsonStr);
                            parsedReply = parsed.reply || parsed.response || textReply;
                            if (Array.isArray(parsed.suggestions)) {
                                suggestions = parsed.suggestions;
                            }
                            if (Array.isArray(parsed.actions)) {
                                const validTypes = ['STOCK_HEAL', 'STOCK_TRANSFER', 'ASSIGN_CUSTODY', 'CREATE_USER', 'EXPORT_EXCEL'];
                                const validActions = (parsed.actions as NexusAction[]).filter(
                                    (a: NexusAction) => a && typeof a === 'object' && validTypes.includes(a.type)
                                );
                                actions.push(...validActions);
                            }
                        }
                    } catch {
                        // Fail gracefully
                    }

                    const result = { intent, query: message, response: parsedReply, actions, suggestions };
                    this.queryCache.set(cacheKey, { response: result, timestamp: Date.now() });
                    return result;
                }
            } catch (err) {
                console.error("Gemini API call failed:", err);
            }
        }

        // 4. Built-in Offline Fallback Generator (If no Gemini or Gemini failed)
        let response = '';
        let suggestions: string[] = [
            "gabadu gana kiyada?",
            "total materials info danna?",
            "how many registered contractors?"
        ];

        if (intent === 'FINANCE') {
            const fin = await NexusContextService.getFinanceContext();
            let retentionText = '';
            if (fin.releasableRetentionsCount > 0) {
                retentionText = `\n\n💡 AI Retention Release Alert (10% Split):\nනිදහස් කිරීමට සුදුසු (Head Office PAT Passed) Invoices ${fin.releasableRetentionsCount} ක් හඳුනාගෙන ඇත. එහි මුළු වටිනාකම LKR ${fin.releasableRetentionsSum.toLocaleString()} කි. \nනිදහස් කිරීමට නිර්දේශිත Invoices:\n${fin.releasableInvoicesList.map((i: string) => `- ${i}`).join('\n')}`;
            }
            response = `පද්ධතියේ දැනට පවතින මුළු හිඟ Contractor Invoices වටිනාකම LKR ${fin.outstandingInvoicesSum.toLocaleString()} කි. පූර්ණ අනුමැතිය ලැබෙන තෙක් බලාපොරොත්තුවෙන් පවතින Payment Vouchers ගණන ${fin.pendingPVsCount} කි.${retentionText}`;
            suggestions = [
                "Pending Payment Vouchers monawada?",
                "how many registered contractors?",
                "total materials info danna?"
            ];
        } else if (intent === 'PROJECTS') {
            const proj = await NexusContextService.getProjectsContext();
            let riskText = '';
            if (proj.projectRisks && proj.projectRisks.length > 0) {
                riskText = `\n\n⚠️ AI Project Risk Warnings:\n` + proj.projectRisks.map(p => `${p.name}\n${p.risks.map((r: string) => `  - ${r}`).join('\n')}`).join('\n\n');
            }
            response = `ක්‍රියාත්මක වන ව්‍යාපෘති ගණන ${proj.activeProjectsCount} කි. ඒ අතරින් දැනට නියමිත දින ඉක්මවා ප්‍රමාද වී ඇති Tasks ප්‍රමාණය ${proj.overdueTasksCount} කි.${riskText}`;
            suggestions = [
                "pending requisitions kiyada?",
                "gabadu gana kiyada?",
                "how many registered contractors?"
            ];
        } else if (intent === 'INVENTORY_LOW') {
            if (!selfHealText) {
                response = `ගබඩාවේ දැනට අවම සීමාවට වඩා අඩු වූ (Low Stock) කිසිදු උපකරණයක් නොමැත.`;
            } else {
                response = `දැනට පද්ධතියේ හඳුනාගත් අවම මට්ටමේ පවතින උපකරණ ලැයිස්තුව (Low Stock):\n\n${contextText.replace(/\*\*/g, '')}${selfHealText.replace(/\*\*/g, '')}`;
            }
            suggestions = [
                "gabadu gana kiyada?",
                "total materials info danna?",
                "Pending Payment Vouchers monawada?"
            ];
        } else if (intent === 'CONTRACTORS') {
            const cont = await NexusContextService.getContractorsContext();
            response = `පද්ධතියේ දැනට ලියාපදිංචි වී ඇති මුළු කොන්ත්‍රාත්කරුවන් (Contractors) ගණන ${cont.contractorsCount} කි.\n\nලියාපදිංචි ප්‍රධාන කොන්ත්‍රාත්කරුවන් කිහිපදෙනෙක්:\n${cont.list.map((c: string) => `- ${c}`).join('\n')}`;
            suggestions = [
                "gabadu gana kiyada?",
                "pending requisitions kiyada?",
                "Pending Payment Vouchers monawada?"
            ];
        } else if (intent === 'STORES') {
            const stores = await NexusContextService.getStoresContext();
            const queryLower = message.toLowerCase();
            
            // Search for specific location query terms
            const words = queryLower.split(/[\s,?.!]+/);
            const locationKeywords = ['anuradhapura', 'kaduwela', 'homagama', 'nittambuwa', 'nuwaraeliya', 'colombo', 'jaffna', 'galle', 'matara', 'kandy'];
            const hasLocationTerm = words.some(w => locationKeywords.includes(w) || w.length > 4);

            if (hasLocationTerm) {
                // Filter stores that match any query word (length > 3)
                const filtered = stores.list.filter(s => {
                    const cleanStore = s.toLowerCase();
                    return words.some(w => w.length > 3 && cleanStore.includes(w));
                });

                if (filtered.length > 0) {
                    response = `පද්ධතියේ ඔබ විමසූ ප්‍රදේශයට අදාළව සක්‍රීයව පවතින ගබඩා (Stores) ගණන ${filtered.length} කි.\n\nඅදාළ ගබඩා ලැයිස්තුව:\n${filtered.map((s: string) => `- ${s}`).join('\n')}`;
                } else {
                    response = `පද්ධතියේ දැනට සක්‍රීයව පවතින මුළු ගබඩා (Active Stores) ගණන ${stores.storesCount} කි.\n\nප්‍රධාන ගබඩා ලැයිස්තුව:\n${stores.list.slice(0, 5).map((s: string) => `- ${s}`).join('\n')}`;
                }
            } else {
                response = `පද්ධතියේ දැනට සක්‍රීයව පවතින මුළු ගබඩා (Active Stores) ගණන ${stores.storesCount} කි.\n\nප්‍රධාන ගබඩා ලැයිස්තුව:\n${stores.list.slice(0, 5).map((s: string) => `- ${s}`).join('\n')}`;
            }
            
            suggestions = [
                "total materials info danna?",
                "how many registered contractors?",
                "pending requisitions kiyada?"
            ];
        } else if (intent === 'INVENTORY_ITEMS') {
            const items = await NexusContextService.getInventoryItemsContext();
            response = `පද්ධතියේ ලියාපදිංචි කර ඇති මුළු ද්‍රව්‍ය/උපකරණ වර්ග (Inventory Items) ගණන ${items.itemsCount} කි.\n\nප්‍රධාන ද්‍රව්‍ය කිහිපයක්:\n${items.list.map((i: string) => `- ${i}`).join('\n')}`;
            suggestions = [
                "gabadu gana kiyada?",
                "how many registered contractors?",
                "Pending Payment Vouchers monawada?"
            ];
        } else if (intent === 'PROCUREMENT') {
            const proc = await NexusContextService.getProcurementContext();
            response = `Procurement Module තත්ත්වය:\n- කෙටුම්පත් මට්ටමේ පවතින Requisitions (PR) ගණන: ${proc.pendingPRsCount}\n- අනුමැතිය බලාපොරොත්තුවෙන් පවතින Purchase Orders (PO) ගණන: ${proc.pendingPOsCount}\n- ලැබීමට නියමිත Goods Receipts (GRN) ගණන: ${proc.pendingGRNsCount}`;
            suggestions = [
                "how many registered contractors?",
                "gabadu gana kiyada?",
                "Pending Payment Vouchers monawada?"
            ];
        } else if (intent === 'VOUCHERS') {
            const vouchers = await NexusContextService.getVouchersContext();
            response = `දැනට අනුමැතිය සඳහා බලාපොරොත්තුවෙන් පවතින මුළු Payment Vouchers (PV) ගණන ${vouchers.pendingPVsCount} කි.`;
            suggestions = [
                "how many registered contractors?",
                "gabadu gana kiyada?",
                "pending requisitions kiyada?"
            ];
        } else if (intent === 'BOM_INVOICES') {
            const bom = await NexusContextService.getBOMInvoicesContext();
            const mismatchSummary = bom.rtomMismatches && bom.rtomMismatches.length > 0
                ? `\n\n⚠️ **RTOM Areas Mismatch Report (ප්‍රාදේශීය ද්‍රව්‍ය වෙනස්කම්):**\n` + 
                  bom.rtomMismatches.map(m => `- RTOM ${m.rtom}: Unbalanced SODs: ${m.mismatchedSODs}/${m.totalSODs} (Accuracy: ${m.accuracyRate}%) | Top Mismatched: ${m.topMismatchedItem}`).join('\n')
                : '\n\n✅ No material mismatches detected across any RTOM area!';
            response = `පද්ධතියට ඇතුළත් කර ඇති මුළු BOM Invoices ගණන ${bom.bomInvoicesCount} කි. ඒ හරහා බිල් කර ඇති මුළු මුදල LKR ${bom.bomRevenueSum.toLocaleString()} ක් වන අතර ස්වයංක්‍රීයව sync කරන ලද මුළු Service Orders (Connections) ගණන ${bom.syncedSODsCount} කි.\n\nමෑතකදී ඇතුළත් කළ BOM Invoices:\n${bom.recentBOMInvoices.map(i => `- ${i}`).join('\n')}${mismatchSummary}`;
            suggestions = [
                "how many active projects?",
                "gabadu gana kiyada?",
                "total materials info danna?"
            ];
        } else {
            response = `ආයුබෝවන්! මම Nexus AI Agent. මට ඔබට Inventory, Projects, Finance, සහ Procurement ආශ්‍රිත සියලුම දත්ත ලබා දිය හැක. උදාහරණ:\n- "low stock items මොනවාද?"\n- "how many registered contractors?"`;
        }

        const result = { intent, query: message, response, actions, suggestions };
        this.queryCache.set(cacheKey, { response: result, timestamp: Date.now() });
        return result;
    }
}
