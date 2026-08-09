import { AppError } from '@/lib/error';
import { primaryClient as prisma } from '@/lib/prisma';
import { CircuitBreaker } from '@/lib/circuit-breaker';

import { StockRequestService } from '../inventory/stock-request.service';
import { NexusContextService } from '@/services/ai/nexus-context.service';
import { NexusClassifierService } from '@/services/ai/nexus-classifier.service';
import type { ChatMessage } from '@/services/ai/nexus-memory.service';

import { safeJsonParse } from '@/utils/safeJsonParse';

/** Circuit breaker: opens after 5 consecutive Gemini API failures, resets after 30s */
const geminiBreaker = new CircuitBreaker(5, 30_000, 'Gemini-AI');

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

export interface NexusChart {
    type: 'bar' | 'pie' | 'line';
    title: string;
    data: Record<string, string | number>[];
    xAxisKey: string;
    seriesKeys: string[];
}

export interface NexusResponse {
    response: string;
    actions?: NexusAction[];
    intent?: string;
    query?: string;
    suggestions?: string[];
    chart?: NexusChart;
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
     * @timeComplexity O(n) - Single pass grouping + single pass matching
     * @spaceComplexity O(n) - Map for grouping stocks by itemId
     */
    static async getSelfHealingProposals(): Promise<NexusAction[]> {
        const stocks = await prisma.inventoryStock.findMany({
            include: { item: true, store: true }
        });

        // O(n) - Group stocks by itemId for O(1) lookup
        const stocksByItem = new Map<string, typeof stocks>();
        for (const s of stocks) {
            if (!stocksByItem.has(s.itemId)) {
                stocksByItem.set(s.itemId, []);
            }
            stocksByItem.get(s.itemId)!.push(s);
        }

        const lowStock = stocks.filter(s => Number(s.quantity) <= Number(s.minLevel));
        const proposals: NexusAction[] = [];

        // O(m) where m = lowStock.length, with O(k) lookup per item (k = stores per item)
        for (const ls of lowStock) {
            const shortageQty = Math.ceil(Number(ls.minLevel) - Number(ls.quantity) + 10);
            
            // O(k) lookup instead of O(n) - only check stores with same item
            const candidates = stocksByItem.get(ls.itemId) || [];
            const excessStock = candidates.find(s => 
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

        if (action.type === 'STOCK_HEAL' || action.type === 'STOCK_TRANSFER') {
            if (!action.itemId || !action.fromStoreId || !action.toStoreId || !action.quantity) {
                throw AppError.badRequest("MISSING_PARAMS");
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
            throw AppError.badRequest("SECURITY_VIOLATION: Direct user creation via AI is disabled for security reasons. Please register new users manually through the User Management Dashboard.");
        }

        throw AppError.badRequest("UNKNOWN_ACTION_TYPE");
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

        const apiKey = process.env.GEMINI_API_KEY;
        console.log("[DEBUG] API KEY Status:", apiKey ? "LOADED" : "MISSING");
        const { NexusMemoryService } = await import('@/services/ai/nexus-memory.service');

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, role: true }
        });
        const userName = user?.name || "User";
        const userRole = user?.role || "ENGINEER";

        // Predictive Intent Classification for Offline Fallback ONLY
        const intent = NexusClassifierService.predict(message);
        const actions: NexusAction[] = [];
        
        // Enforce Role-Based Information Hiding
        const hasFinanceAccess = [
            'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 
            'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 
            'INVOICE_MANAGER', 'INVOICE_ASSISTANT'
        ].includes(userRole);

        if ((intent === 'FINANCE' || intent === 'BOM_INVOICES' || intent === 'VOUCHERS' || msgLower.includes('finance') || msgLower.includes('invoice')) && !hasFinanceAccess) {
            return {
                intent,
                query: message,
                response: `⚠️ Unauthorized: Your role (${userRole}) is not authorized to access financial or billing reports. This query has been blocked for security.`,
                actions: [],
                suggestions: ["Show active projects status", "List current low stock items"]
            };
        }

        if (apiKey) {
            try {
                const history = await NexusMemoryService.getConversation(userId);
                const result = await this.runAgenticLoop(message, userId, history, userRole, userName, hasFinanceAccess);
                if (result) {
                    this.queryCache.set(cacheKey, { response: result, timestamp: Date.now() });
                    return result;
                } else {
                    console.log("[DEBUG] runAgenticLoop returned null");
                }
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error("[DEBUG] Gemini API Function Calling failed, falling back to offline mode:", error.message);
                } else {
                    console.error("[DEBUG] Gemini API Function Calling failed, falling back to offline mode:", error);
                }
            }
        }

        // --- OFFLINE FALLBACK ---
        let response = 'ආයුබෝවන්! මම Nexus AI Agent. මට ඔබට Inventory, Projects, Finance, සහ Procurement ආශ්‍රිත සියලුම දත්ත ලබා දිය හැක. උදාහරණ:\n- "low stock items මොනවාද?"\n- "how many registered contractors?"';
        const suggestions = ["gabadu gana kiyada?", "total materials info danna?", "how many registered contractors?"];

        // (Offline fallback logic simplified for brevity, maintaining original intent handling)
        if (intent === 'FINANCE') {
            const fin = await NexusContextService.getFinanceContext();
            response = `පද්ධතියේ දැනට පවතින මුළු හිඟ Contractor Invoices වටිනාකම LKR ${fin.outstandingInvoicesSum.toLocaleString()} කි. පූර්ණ අනුමැතිය ලැබෙන තෙක් බලාපොරොත්තුවෙන් පවතින Payment Vouchers ගණන ${fin.pendingPVsCount} කි.`;
        } else if (intent === 'PROJECTS') {
            const proj = await NexusContextService.getProjectsContext();
            response = `ක්‍රියාත්මක වන ව්‍යාපෘති ගණන ${proj.activeProjectsCount} කි. ඒ අතරින් දැනට නියමිත දින ඉක්මවා ප්‍රමාද වී ඇති Tasks ප්‍රමාණය ${proj.overdueTasksCount} කි.`;
        } else if (intent === 'INVENTORY_LOW') {
            const low = await NexusContextService.getInventoryLowStockContext();
            response = low.lowStock.length > 0 
                ? `දැනට පද්ධතියේ හඳුනාගත් අවම මට්ටමේ පවතින උපකරණ:\n` + low.lowStock.map(s => `- ${s.itemName} in ${s.storeName}: Current ${s.qty}`).join('\n')
                : `ගබඩාවේ දැනට අවම සීමාවට වඩා අඩු වූ (Low Stock) කිසිදු උපකරණයක් නොමැත.`;
        } else if (intent === 'PROCUREMENT') {
            const data = await NexusContextService.getProcurementContext();
            response = `මිලදී ගැනීමේ (Procurement) සාරාංශය:\n\n- Pending PRs: ${data.pendingPRsCount}\n- Pending POs: ${data.pendingPOsCount}\n- Pending GRNs: ${data.pendingGRNsCount}\n- Completed GRNs: ${data.completedGRNsCount}`;
        } else if (intent === 'SERVICE_ORDER_PROGRESS') {
            const data = await NexusContextService.getServiceOrderProgressContext();
            response = `මෙන්න දෛනික සේවා ඇණවුම් (Service Order) ප්‍රගතිය:\n\n- Completed: ${data.totalCompleted}\n- In Hand: ${data.totalInHand}\n- Today's SODs: ${data.totalTodaysSOD}`;
        }

        const result = { intent, query: message, response, actions, suggestions };
        this.queryCache.set(cacheKey, { response: result, timestamp: Date.now() });
        return result;
    }

    /**
     * Fully Dynamic Agentic Loop with Gemini Function Calling
     */
    private static async runAgenticLoop(message: string, userId: string, history: ChatMessage[], userRole: string, userName: string, hasFinanceAccess: boolean): Promise<NexusResponse | null> {
        // Step 1: Pre-flight Local AI Routing
        const { intent, confidence } = NexusClassifierService.predictWithConfidence(message);
        
        const msgLowerForChart = message.toLowerCase();
        const wantsChart = msgLowerForChart.includes('chart') || msgLowerForChart.includes('graph') || msgLowerForChart.includes('prastar') || msgLowerForChart.includes('satahan') || msgLowerForChart.includes('plot');
        
        if (confidence > 0.85) {
            console.log(`[ROUTER] High confidence local prediction: ${intent} (${(confidence * 100).toFixed(1)}%) -> BYPASSING CLOUD API`);
            
            // Hardcoded zero-cost Local AI static responses for known intents
            if (intent === 'INVENTORY_LOW') {
                const data = await NexusContextService.getInventoryLowStockContext();
                
                let chart: NexusChart | undefined;
                if (wantsChart && data.lowStock.length > 0) {
                    chart = {
                        type: 'bar',
                        title: 'Low Stock Items (Top 10)',
                        xAxisKey: 'itemName',
                        seriesKeys: ['qty'],
                        data: data.lowStock.slice(0, 10).map((i: { itemName: string; qty: number }) => ({ itemName: i.itemName, qty: i.qty }))
                    };
                }
                
                return {
                    response: `මෙන්න දැනට හිඟව පවතින අයිතමයන්:\n\n` + data.lowStock.slice(0, 10).map((i: { itemName: string; storeName: string; qty: number }) => `- ${i.itemName} (Store: ${i.storeName}, Qty: ${i.qty})`).join('\n'),
                    actions: data.lowStock.length > 0 ? [{
                        type: 'autonomous_stock_transfer',
                        description: `Autonomous Stock Replenishment`,
                        suggestions: data.lowStock.map((i: { itemName: string; storeName: string }) => `Transfer 10 units of ${i.itemName} to ${i.storeName}`)
                    } as unknown as NexusAction] : [],
                    suggestions: ['Show all low stock items', 'Check active projects'],
                    chart
                };
            }
            if (intent === 'PROJECTS') {
                const data = await NexusContextService.getProjectsContext();
                
                let chart: NexusChart | undefined;
                if (wantsChart) {
                    chart = {
                        type: 'pie',
                        title: 'Project Status Overview',
                        xAxisKey: 'status',
                        seriesKeys: ['count'],
                        data: [
                            { status: 'Active', count: data.activeProjectsCount },
                            { status: 'Delayed', count: data.overdueTasksCount },
                            { status: 'At Risk', count: data.projectRisks.length }
                        ]
                    };
                }
                
                return {
                    response: `පද්ධතියේ දැනට ක්‍රියාත්මක වන ව්‍යාපෘති පිළිබඳ විස්තර:\n\n- Active Projects: ${data.activeProjectsCount}\n- Delayed Tasks: ${data.overdueTasksCount}\n- Projects at Risk: ${data.projectRisks.length}`,
                    actions: [],
                    suggestions: ['Show Service Order Progress'],
                    chart
                };
            }
            if (intent === 'PROCUREMENT') {
                const data = await NexusContextService.getProcurementContext();
                
                return {
                    response: `මිලදී ගැනීමේ (Procurement) සාරාංශය:\n\n- Pending PRs (Purchase Requisitions): ${data.pendingPRsCount}\n- Pending POs (Purchase Orders): ${data.pendingPOsCount}\n- Pending GRNs: ${data.pendingGRNsCount}\n- Completed GRNs: ${data.completedGRNsCount}\n\nඅවසන් වරට සම්පූර්ණ කළ GRN එක: ${data.latestCompletedGRN}`,
                    actions: [],
                    suggestions: ['Show pending payment vouchers', 'Check low stock items'],
                };
            }
            if (intent === 'SERVICE_ORDER_PROGRESS') {
                const data = await NexusContextService.getServiceOrderProgressContext();
                
                let chart: NexusChart | undefined;
                if (wantsChart) {
                    chart = {
                        type: 'bar',
                        title: 'Daily Service Order Progress by OPMC',
                        xAxisKey: 'opmcName',
                        seriesKeys: ['completed', 'inHand', 'todaysSOD'],
                        data: data.dailyProgress.map((p: { opmcName: string; completed: number; inHand: number; todaysSOD: number }) => ({
                            opmcName: p.opmcName,
                            completed: p.completed,
                            inHand: p.inHand,
                            todaysSOD: p.todaysSOD
                        }))
                    };
                }
                
                return {
                    response: `මෙන්න දෛනික සේවා ඇණවුම් (Service Order) ප්‍රගතිය:\n\n- Completed: ${data.totalCompleted}\n- In Hand: ${data.totalInHand}\n- Today's SODs: ${data.totalTodaysSOD}`,
                    actions: [],
                    suggestions: ['Show Job Costing for R-MD', 'Check Low Stock'],
                    chart
                };
            }
            if (intent === 'JOB_COSTING' && hasFinanceAccess) {
                const data = await NexusContextService.getJobCostingContext();
                
                let chart: NexusChart | undefined;
                if (wantsChart && 'financials' in data && data.financials) {
                    chart = {
                        type: 'bar',
                        title: 'Job Costing & Profitability (All Regions)',
                        xAxisKey: 'metric',
                        seriesKeys: ['value'],
                        data: [
                            { metric: 'Revenue', value: data.financials.totalRevenue },
                            { metric: 'Material Cost', value: data.financials.totalMaterialCost },
                            { metric: 'Contractor Payout', value: data.financials.totalContractorPayout },
                            { metric: 'Net Profit', value: data.financials.netProfit }
                        ]
                    };
                }
                
                return {
                    response: ('summary' in data && data.summary) ? data.summary : (data.message || "No data found."),
                    actions: [],
                    suggestions: ['Show Finance Context', 'Check Pending Vouchers'],
                    chart
                };
            }
            if (intent === 'FINANCE' && hasFinanceAccess) {
                const data = await NexusContextService.getFinanceContext();
                
                let chart: NexusChart | undefined;
                if (wantsChart) {
                    chart = {
                        type: 'pie',
                        title: 'Financial Balances',
                        xAxisKey: 'category',
                        seriesKeys: ['amount'],
                        data: [
                            { category: 'Outstanding Invoices', amount: Number(data.outstandingInvoicesSum) },
                            { category: 'Pending PVs', amount: Number(data.pendingPVsCount) * 1000 }, // Mock scaled value for visual balance in pie chart
                            { category: 'Releasable Retentions', amount: Number(data.releasableRetentionsSum) }
                        ]
                    };
                }
                
                return {
                    response: `මූල්‍ය තොරතුරු:\n- හිඟ ඉන්වොයිස්: Rs.${data.outstandingInvoicesSum}\n- රඳවාගත් මුදල් (Releasable): Rs.${data.releasableRetentionsSum}\n- Pending PVs: ${data.pendingPVsCount}`,
                    actions: [],
                    suggestions: ['Show Job Costing'],
                    chart
                };
            }
            // Fallback: If intent matches but no static response implemented, continue to Cloud API
            console.log(`[ROUTER] No static handler implemented for ${intent}, continuing to Cloud API...`);
        } else {
            console.log(`[ROUTER] Low confidence local prediction: ${intent} (${(confidence * 100).toFixed(1)}%) -> ROUTING TO CLOUD API`);
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const modelName = 'gemini-3.5-flash-lite'; // 500 RPD limit model
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const tools = [{
            functionDeclarations: [
                {
                    name: "getFinanceContext",
                    description: "Fetch finance metrics including outstanding invoices and pending payment vouchers. ONLY call this if user is authorized."
                },
                {
                    name: "getProjectsContext",
                    description: "Fetch active projects, overdue tasks, and project risks."
                },
                {
                    name: "getInventoryLowStockContext",
                    description: "Fetch inventory items that are currently running low on stock across all stores."
                },
                {
                    name: "getContractorsContext",
                    description: "Fetch registered contractors and their types."
                },
                {
                    name: "getStoresContext",
                    description: "Fetch a list of all active inventory stores and regions."
                },
                {
                    name: "getProcurementContext",
                    description: "Fetch procurement metrics including pending PRs, POs, and GRNs."
                },
                {
                    name: "getBOMInvoicesContext",
                    description: "Fetch Bill of Materials (BOM) invoices and RTOM mismatch reports."
                },
                {
                    name: "getServiceOrderProgressContext",
                    description: "Fetch Service Order daily progress including Completed, In-Hand, and Today's SODs. Optionally filter by OPMC Code (e.g. R-MD).",
                    parameters: {
                        type: "object",
                        properties: {
                            opmcCode: { type: "string", description: "Optional OPMC Code or Region name (e.g., R-MD, Colombo)" }
                        }
                    }
                },
                {
                    name: "getJobCostingContext",
                    description: "Fetch Job Costing, Revenue, Material Cost, and Profitability for Service Orders. Reason across multiple tables.",
                    parameters: {
                        type: "object",
                        properties: {
                            rtom: { type: "string", description: "Optional RTOM or OPMC Code (e.g., R-MD)" },
                            monthYYYYMM: { type: "string", description: "Optional Month in YYYYMM format (e.g., 202310)" },
                            status: { type: "string", description: "Optional status (e.g., COMPLETED, INPROGRESS)" }
                        }
                    }
                }
            ]
        }];

        const systemPrompt = `You are "Nexus Agent", a FULLY AUTONOMOUS global AI assistant of SLTS Nexus ERP.
You have access to a set of internal tools (functions) to fetch live data from the ERP database.
When a user asks a question, YOU MUST dynamically decide which tool to call to get the exact data needed, OR answer directly if you already know.

CRITICAL INSTRUCTIONS & ANTI-HALLUCINATION:
1. GREETING: Greet the user by their name: ${userName}.
2. LANGUAGE: Answer in the language of the user's choice (Sinhala, English, or Singlish).
3. NO GUESSING (ANTI-HALLUCINATION): If you do NOT find the EXACT answer in the provided tool context or database output, DO NOT guess. DO NOT hallucinate numbers. You MUST explicitly say "මෙම තොරතුර මගේ දත්ත ගොනුවේ නොමැත" (I do not have this information). 
4. STRICT TOOL DATA: Your response MUST exactly match the values returned by the tools.
5. TOOL USAGE: If you need to fetch data from tools, use the native tool calling capability. DO NOT output a JSON array of tool calls.
6. JSON FORMAT: When providing your FINAL answer, your response MUST be a valid JSON object matching this exact schema.

FEW-SHOT EXAMPLES (Query -> Expected JSON Output):
Example 1: "Low stock items monawada?"
{
  "reply": "පහත දැක්වෙන්නේ දැනට හිඟව පවතින අයිතමයන් වේ...",
  "actions": [],
  "suggestions": ["Show OPMC daily progress", "Show active projects"]
}

Example 2: "Show OPMC daily progress bar chart"
{
  "reply": "මෙන්න OPMC දෛනික ප්‍රගති සටහන:",
  "actions": [],
  "suggestions": ["Check stock availability"],
  "chart": {
     "type": "bar",
     "title": "Daily Service Order Progress by OPMC",
     "xAxisKey": "opmcName",
     "seriesKeys": ["completed", "inHand", "todaysSOD"],
     "data": [ { "opmcName": "R-MD", "completed": 50, "inHand": 120, "todaysSOD": 10 } ]
  }
}

NOTE: Only include the "chart" key if the user explicitly asks to visualize, draw a graph, or chart the data. Otherwise, omit it entirely.
`;

        const contents: Array<{ role: string; parts: unknown[] }> = [
            ...history,
            { role: 'user', parts: [{ text: message }] }
        ];

        // Round 1: Ask Gemini
        let response = await geminiBreaker.execute(() => fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                tools,
                contents
            })
        }));

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[DEBUG] First Gemini API fetch failed. Status:", response.status, "Error:", errorText);
            return null;
        }
        let data = await response.json();
        // Extract the function call(s) properly
        let functionCalls: Array<{ name: string; id?: string; args?: Record<string, unknown> }> = [];
        if (data.candidates?.[0]?.content?.parts) {
            functionCalls = data.candidates[0].content.parts.filter((p: { functionCall?: unknown }) => p.functionCall).map((p: { functionCall: { name: string; id?: string; args?: Record<string, unknown> } }) => p.functionCall);
        }

        // Loop up to 3 times to allow the model to call multiple tools sequentially
        let iterations = 0;
        const MAX_ITERATIONS = 3;
        let didCheckLowStock = false;
        let executedIntent: string | null = null;

        while (functionCalls.length > 0 && iterations < MAX_ITERATIONS) {
            iterations++;
            
            // Push the exact model response to history (preserves thought_signature)
            contents.push(data.candidates[0].content);

            const functionResponses: Array<{ functionResponse: { name: string; id?: string; response: { name: string; content: Record<string, unknown> | unknown } } }> = [];

            for (const fc of functionCalls) {
                const funcName = fc.name;
                let funcResult = {};

                // Execute local function
                if (funcName === 'getFinanceContext' && hasFinanceAccess) {
                    funcResult = await NexusContextService.getFinanceContext();
                    executedIntent = 'FINANCE';
                } else if (funcName === 'getProjectsContext') {
                    funcResult = await NexusContextService.getProjectsContext();
                    executedIntent = 'PROJECTS';
                } else if (funcName === 'getInventoryLowStockContext') {
                    didCheckLowStock = true;
                    funcResult = await NexusContextService.getInventoryLowStockContext();
                    executedIntent = 'INVENTORY_LOW';
                } else if (funcName === 'getContractorsContext') {
                    funcResult = await NexusContextService.getContractorsContext();
                    executedIntent = 'CONTRACTORS';
                } else if (funcName === 'getStoresContext') {
                    funcResult = await NexusContextService.getStoresContext();
                    executedIntent = 'STORES';
                } else if (funcName === 'getProcurementContext') {
                    funcResult = await NexusContextService.getProcurementContext();
                    executedIntent = 'PROCUREMENT';
                } else if (funcName === 'getBOMInvoicesContext' && hasFinanceAccess) {
                    funcResult = await NexusContextService.getBOMInvoicesContext();
                    executedIntent = 'BOM_INVOICES';
                } else if (funcName === 'getServiceOrderProgressContext') {
                    const args = fc.args as Record<string, string> | undefined;
                    funcResult = await NexusContextService.getServiceOrderProgressContext(args?.opmcCode);
                    // Service order maps loosely to projects or a new intent, skipping mapping for simplicity
                } else if (funcName === 'getJobCostingContext' && hasFinanceAccess) {
                    const args = fc.args as Record<string, string> | undefined;
                    funcResult = await NexusContextService.getJobCostingContext(args);
                    executedIntent = 'JOB_COSTING';
                } else {
                    funcResult = { error: "Unauthorized or unknown function." };
                }

                functionResponses.push({
                    functionResponse: {
                        name: funcName,
                        id: fc.id,
                        response: {
                            name: funcName,
                            content: (typeof funcResult === 'object' && funcResult !== null) ? (funcResult as Record<string, unknown>) : { result: funcResult }
                        }
                    }
                });
            }
            
            // Append our function responses to history (Newer Gemini models expect role: 'user')
            contents.push({ role: 'user', parts: functionResponses });

            // Call Gemini again with the function results
            response = await geminiBreaker.execute(() => fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    tools,
                    contents
                })
            }));

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[DEBUG] Gemini API tool fetch failed. Status:", response.status, "Error:", errorText);
                return null;
            }
            data = await response.json();
            
            // Re-evaluate function calls for the next iteration
            functionCalls = [];
            if (data.candidates?.[0]?.content?.parts) {
                functionCalls = data.candidates[0].content.parts.filter((p: { functionCall?: unknown }) => p.functionCall).map((p: { functionCall: { name: string; id?: string; args?: Record<string, unknown> } }) => p.functionCall);
            }
        }

        const textReply = data.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
        if (!textReply) {
            console.log("[DEBUG] textReply is null! Raw data:", JSON.stringify(data, null, 2));
            return null;
        }

        // Step 3: Self-Training (Continuous Learning)
        // If Gemini successfully understood the user's intent and called a tool, feed this back into Local AI!
        if (executedIntent) {
            NexusClassifierService.addTrainingExample(executedIntent, message).catch(err => {
                console.error("[ROUTER] Failed to add continuous training data:", err);
            });
        }

        let parsedReply = textReply;
        let suggestions = ["Show active projects status", "List current low stock items"];
        let actions: NexusAction[] = [];
        let chart: NexusChart | undefined = undefined;

        const firstBrace = textReply.indexOf('{');
        const lastBrace = textReply.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            const jsonStr = textReply.substring(firstBrace, lastBrace + 1);
            const parsed = safeJsonParse<Record<string, unknown>>(jsonStr, {});
            
            if (parsed && Object.keys(parsed).length > 0) {
                const textBeforeJson = textReply.substring(0, firstBrace).trim();
                parsedReply = (parsed.reply || parsed.response || textBeforeJson || textReply) as string;
                if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions as string[];
                if (Array.isArray(parsed.actions)) actions = parsed.actions as NexusAction[];
                if (parsed.chart && typeof parsed.chart === 'object') chart = parsed.chart as NexusChart;
            }
        }

        // Attempt Self-Healing only if low stock was explicitly fetched by the LLM
        if (didCheckLowStock) {
             const selfHealing = await this.getSelfHealingProposals();
             if (selfHealing.length > 0) {
                 actions.push(...selfHealing.slice(0, 2));
                 parsedReply += `\n\n💡 **Autonomous Stock Replenishment (තොග හිඟය පියවීමේ යෝජනා):**\n` + selfHealing.map(p => `- ${p.fromStoreName} හි ඇති අතිරික්තයෙන් ${p.itemName} ${p.quantity} ක් ${p.toStoreName} වෙත මාරු කිරීමෙන් හිඟය පියවිය හැක.`).join('\n');
             }
        }

        return {
            intent: 'DYNAMIC_AGENT',
            query: message,
            response: parsedReply,
            actions,
            suggestions,
            chart
        };
    }
}
