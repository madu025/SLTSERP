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
    type: 'STOCK_HEAL' | 'STOCK_TRANSFER' | 'ASSIGN_CUSTODY' | 'CREATE_USER';
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
}

export interface NexusResponse {
    response: string;
    actions?: NexusAction[];
    intent?: string;
    query?: string;
    suggestions?: string[];
}

export class NexusAgentService {
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
        const apiKey = process.env.GEMINI_API_KEY;
        const { NexusMemoryService } = await import('./nexus-memory.service');

        // Fetch user name to personalize AI greetings
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
        });
        const userName = user?.name || "User";

        // 1. Predictive Intent Classification
        const intent = NexusClassifierService.predict(message);
        const actions: NexusAction[] = [];
        
        // 2. Fetch Modular Context (Only what is needed!)
        let contextText = '';
        let selfHealText = '';
        
        switch(intent) {
            case 'FINANCE': {
                const fin = await NexusContextService.getFinanceContext();
                contextText = `Outstanding Invoices: LKR ${fin.outstandingInvoicesSum.toLocaleString()}\nPending PVs: ${fin.pendingPVsCount}`;
                break;
            }
            case 'PROJECTS': {
                const proj = await NexusContextService.getProjectsContext();
                contextText = `Active Projects: ${proj.activeProjectsCount}\nOverdue Tasks: ${proj.overdueTasksCount}`;
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
                contextText = `Registered Contractors: ${cont.contractorsCount}`;
                break;
            }
            case 'STORES': {
                const stores = await NexusContextService.getStoresContext();
                contextText = `Active Stores: ${stores.storesCount}`;
                break;
            }
            case 'INVENTORY_ITEMS': {
                const items = await NexusContextService.getInventoryItemsContext();
                contextText = `Total Inventory Items: ${items.itemsCount}`;
                break;
            }
            case 'PROCUREMENT': {
                const proc = await NexusContextService.getProcurementContext();
                contextText = `Pending PRs: ${proc.pendingPRsCount}\nPending POs: ${proc.pendingPOsCount}\nPending GRNs: ${proc.pendingGRNsCount}`;
                break;
            }
            case 'VOUCHERS': {
                const vouchers = await NexusContextService.getVouchersContext();
                contextText = `Pending PVs: ${vouchers.pendingPVsCount}`;
                break;
            }
            default:
                contextText = "General queries mapping context.";
                break;
        }

        // 3. Gemini Generation (if API key available)
        if (apiKey) {
            const history = await NexusMemoryService.getConversation(userId);
            
            // Fetch Unified complete system context so Gemini has global cross-module understanding
            const fullContext = await NexusContextService.getContext();
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
  "suggestions": [
     "A relevant follow-up question the user might want to ask next based on your reply",
     "Another relevant follow-up question",
     "A third relevant follow-up question"
  ]
}
4. IMPORTANT: In your "reply" text, DO NOT wrap numbers or values in double asterisks (**). Output clean, plain numbers and text to maintain a professional look.
Do not return any markdown wrapping or other text outside this JSON object.

Complete Live ERP System Context:
${JSON.stringify(fullContext, null, 2)}
${healingPrompt}
`;
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system_instruction: { parts: [{ text: systemPrompt }] },
                            contents: [
                                ...history,
                                { role: 'user', parts: [{ text: message }] }
                            ]
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
                        }
                    } catch {
                        // Fail gracefully
                    }

                    return { intent, query: message, response: parsedReply, actions, suggestions };
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
            response = `පද්ධතියේ දැනට සක්‍රීයව පවතින මුළු ගබඩා (Active Stores) ගණන ${stores.storesCount} කි.\n\nප්‍රධාන ගබඩා ලැයිස්තුව:\n${stores.list.map((s: string) => `- ${s}`).join('\n')}`;
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
        } else {
            response = `ආයුබෝවන්! මම Nexus AI Agent. මට ඔබට Inventory, Projects, Finance, සහ Procurement ආශ්‍රිත සියලුම දත්ත ලබා දිය හැක. උදාහරණ:\n- "low stock items මොනවාද?"\n- "how many registered contractors?"`;
        }

        return { intent, query: message, response, actions, suggestions };
    }
}
