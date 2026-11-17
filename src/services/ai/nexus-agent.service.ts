import { AppError } from '@/lib/error';
import { primaryClient as prisma } from '@/lib/prisma';
import { CircuitBreaker } from '@/lib/circuit-breaker';

import { StockRequestService } from '../inventory/stock-request.service';
import { NexusContextService } from '@/services/ai/nexus-context.service';
import { NexusClassifierService } from '@/services/ai/nexus-classifier.service';
import type { ChatMessage } from '@/services/ai/nexus-memory.service';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { checkRateLimit } from '@/lib/rate-limiter';
import { NexusPrivacyService, type PrivacyMode } from '@/services/ai/nexus-privacy.service';
import { ExecutiveMetricService, METRIC_IDS, type MetricId } from '@/services/ai/executive-metrics.service';
import { ExecutiveInsightService } from '@/services/ai/executive-insights.service';
import { groundReportFilters, describeSearch, SERVICE_ORDER_STATUSES } from '@/services/ai/semantic-layer.service';
import { NexusLocalReplyService, type ToolRun } from '@/services/ai/nexus-local-reply.service';
import { DynamicReportService, type DynamicReportPayload, type FilterRule, type AggregationConfig } from '@/services/inventory/dynamic-report.service';
import type { NexusOpmcScope } from '@/services/ai/nexus-context.service';

import { safeJsonParse } from '@/utils/safeJsonParse';
import { slDayKey } from '@/lib/sl-time';

/** Circuit breaker: opens after 5 consecutive Gemini API failures, resets after 30s */
const geminiBreaker = new CircuitBreaker(5, 30_000, 'Gemini-AI');
const deepseekBreaker = new CircuitBreaker(5, 30_000, 'DeepSeek-AI');

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

export interface NexusCard {
    label: string;
    value: string;
    /** change versus the comparison period, e.g. +4.2% */
    delta?: string;
    trend?: 'up' | 'down' | 'flat';
    /** true when the change is good for the business, false when bad, null/undefined when neutral */
    good?: boolean | null;
    caption?: string;
}

export interface NexusTable {
    title: string;
    columns: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
    truncated: boolean;
    /** a click on a value in `column` asks the assistant `template` with {value} filled in */
    drill?: { column: string; template: string };
    /** true when the database limit (500 rows) cut the result, so more matching rows exist */
    capped?: boolean;
}

export interface NexusResponse {
    /** one line saying exactly what was searched, so the answer can be verified at a glance */
    evidence?: string;
    table?: NexusTable;
    cards?: NexusCard[];
    response: string;
    actions?: NexusAction[];
    intent?: string;
    query?: string;
    suggestions?: string[];
    chart?: NexusChart;
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
     * @timeComplexity O(n) - Single pass grouping + single pass matching
     * @spaceComplexity O(n) - Map for grouping stocks by itemId
     */
    static async getSelfHealingProposals(): Promise<NexusAction[]> {
        const stocks = await prisma.inventoryStock.findMany({
            select: {
                itemId: true, storeId: true, quantity: true, minLevel: true,
                item: { select: { code: true, name: true } },
                store: { select: { name: true } },
            },
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
            // The action object comes from the browser, so it is never trusted: it must match a proposal the
            // server derives from current stock, and the quantity can only be at or below what was proposed.
            const proposals = await this.getSelfHealingProposals();
            const match = proposals.find((p) => p.itemId === action.itemId && p.fromStoreId === action.fromStoreId && p.toStoreId === action.toStoreId);
            const qty = Number(action.quantity);
            if (!match || !Number.isFinite(qty) || qty <= 0 || qty > Number(match.quantity)) {
                throw AppError.badRequest('ACTION_NOT_VALID: this transfer is no longer a valid proposal for the current stock levels.');
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
     * Process user query using Google Gemini API or fallback matching
     */
    static async ask(message: string, userId: string): Promise<NexusResponse> {
        // Per-user limits protect the shared model quota: a short burst limit and a daily limit.
        const burst = await checkRateLimit(userId, { max: Number(process.env.NEXUS_RATE_BURST) || 20, windowSecs: 600, prefix: 'nexus-burst' });
        const daily = burst.allowed ? await checkRateLimit(userId, { max: Number(process.env.NEXUS_RATE_DAILY) || 200, windowSecs: 86_400, prefix: 'nexus-daily' }) : burst;
        if (!burst.allowed || !daily.allowed) {
            const wait = Math.max(1, Math.ceil((!burst.allowed ? burst.resetSecs : daily.resetSecs) / 60));
            return {
                intent: 'RATE_LIMITED',
                query: message,
                response: `You have reached the assistant limit for now. Please try again in about ${wait} minute(s).`,
                actions: [],
                suggestions: [],
            };
        }
        const result = await this.answer(message, userId);
        // Remember the exchange so follow-up questions have context (best effort: never blocks the answer)
        try {
            const { NexusMemoryService } = await import('@/services/ai/nexus-memory.service');
            await NexusMemoryService.appendTurn(userId, message, result.response);
        } catch (error) {
            console.warn('[NEXUS] Could not save conversation:', error instanceof Error ? error.message : error);
        }
        return result;
    }

    private static async answer(message: string, userId: string): Promise<NexusResponse> {
        const msgLower = message.toLowerCase();

        const apiKey = process.env.GEMINI_API_KEY;
        const { NexusMemoryService } = await import('@/services/ai/nexus-memory.service');

        const [user, userPermissions, opmcScope] = await Promise.all([
            prisma.user.findUnique({
            where: { id: userId },
                select: { name: true }
            }),
            getUserEffectivePermissions(userId),
            resolveOpmcScope(userId),
        ]);
        const userName = user?.name || "User";
        const permissionSet = new Set(userPermissions);

        // Predictive Intent Classification for Offline Fallback ONLY
        const predicted = NexusClassifierService.predict(message);
        const actions: NexusAction[] = [];
        
        // Permissions are enforced where data is read: every assistant tool checks its own capability and the caller's
        // OPMC scope (executeTool), and the fixed local answers below check the intent's capability before they run.
        // A keyword/classifier gate in front of everything wrongly blocked allowed questions (coordinators and QC
        // officers could not ask about service orders because the classifier guessed "finance").

        if (apiKey || process.env.DEEPSEEK_API_KEY || process.env.NEXUS_LLM_API_KEY || (process.env.NEXUS_LLM_PROVIDER === 'local' && process.env.NEXUS_LLM_BASE_URL)) {
            try {
                const history = await NexusMemoryService.getConversation(userId);
                const result = await this.runAgenticLoop(message, history, userName, permissionSet, opmcScope, userId);
                if (result) {
                    return result;
                } else {
                }
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error("[NEXUS] Cloud model call failed, using offline mode:", error.message);
                } else {
                    console.error("[NEXUS] Cloud model call failed, using offline mode");
                }
            }
        }

        // --- OFFLINE FALLBACK ---
        // Only answer with a fixed module summary when the question is a phrasing we know. Otherwise a
        // report-style request ("status wise count") was answered with an unrelated Procurement summary.
        const knownPhrase = await NexusClassifierService.hasNearExample(message, predicted);
        if (knownPhrase && !this.canReadIntent(predicted, msgLower, permissionSet)) {
            return {
                intent: predicted,
                query: message,
                response: '⚠️ Unauthorized: you do not have the canonical permission required for this module. This query has been blocked for security.',
                actions: [],
                suggestions: ["Show active projects status", "List current low stock items"]
            };
        }
        const intent = knownPhrase ? predicted : 'UNKNOWN';
        let response = 'ආයුබෝවන්! මම Nexus AI Agent. මට ඔබට Inventory, Projects, Finance, සහ Procurement ආශ්‍රිත සියලුම දත්ත ලබා දිය හැක. උදාහරණ:\n- "low stock items මොනවාද?"\n- "how many registered contractors?"';
        const suggestions = ["gabadu gana kiyada?", "total materials info danna?", "how many registered contractors?"];

        // (Offline fallback logic simplified for brevity, maintaining original intent handling)
        if (intent === 'FINANCE') {
            const fin = await NexusContextService.getFinanceContext(opmcScope);
            response = `පද්ධතියේ දැනට පවතින මුළු හිඟ Contractor Invoices වටිනාකම LKR ${fin.outstandingInvoicesSum.toLocaleString()} කි. පූර්ණ අනුමැතිය ලැබෙන තෙක් බලාපොරොත්තුවෙන් පවතින Payment Vouchers ගණන ${fin.pendingPVsCount} කි.`;
        } else if (intent === 'PROJECTS') {
            const proj = await NexusContextService.getProjectsContext(opmcScope);
            response = `ක්‍රියාත්මක වන ව්‍යාපෘති ගණන ${proj.activeProjectsCount} කි. ඒ අතරින් දැනට නියමිත දින ඉක්මවා ප්‍රමාද වී ඇති Tasks ප්‍රමාණය ${proj.overdueTasksCount} කි.`;
        } else if (intent === 'INVENTORY_LOW') {
            const low = await NexusContextService.getInventoryLowStockContext(opmcScope);
            response = low.lowStock.length > 0 
                ? `දැනට පද්ධතියේ හඳුනාගත් අවම මට්ටමේ පවතින උපකරණ:\n` + low.lowStock.map(s => `- ${s.itemName} in ${s.storeName}: Current ${s.qty}`).join('\n')
                : `ගබඩාවේ දැනට අවම සීමාවට වඩා අඩු වූ (Low Stock) කිසිදු උපකරණයක් නොමැත.`;
        } else if (intent === 'PROCUREMENT') {
            const data = await NexusContextService.getProcurementContext(opmcScope);
            response = `මිලදී ගැනීමේ (Procurement) සාරාංශය:\n\n- Pending PRs: ${data.pendingPRsCount}\n- Pending POs: ${data.pendingPOsCount}\n- Pending GRNs: ${data.pendingGRNsCount}\n- Completed GRNs: ${data.completedGRNsCount}`;
        } else if (intent === 'SERVICE_ORDER_PROGRESS') {
            const data = await NexusContextService.getServiceOrderProgressContext(undefined, opmcScope);
            response = `මෙන්න දෛනික සේවා ඇණවුම් (Service Order) ප්‍රගතිය:\n\n- Completed: ${data.totalCompleted}\n- In Hand: ${data.totalInHand}\n- Today's SODs: ${data.totalTodaysSOD}`;
        }

        const result = { intent, query: message, response, actions, suggestions };
        return result;
    }

    private static hasAnyPermission(permissions: ReadonlySet<string>, required: readonly string[]) {
        return required.some(permission => permissions.has(permission));
    }

    private static canReadIntent(intent: string, message: string, permissions: ReadonlySet<string>) {
        if (intent === 'FINANCE' || intent === 'BOM_INVOICES' || intent === 'VOUCHERS' || intent === 'JOB_COSTING'
            || message.includes('finance') || message.includes('invoice') || message.includes('voucher') || message.includes('job costing')) {
            return this.hasAnyPermission(permissions, [
                RBAC_PERMISSIONS.FINANCE_READ,
                RBAC_PERMISSIONS.PROJECT_FINANCE_READ,
                RBAC_PERMISSIONS.FINANCE_AUDIT,
            ]);
        }
        if (intent === 'PROJECTS') return permissions.has(RBAC_PERMISSIONS.PROJECT_READ);
        if (intent === 'INVENTORY_LOW') return permissions.has(RBAC_PERMISSIONS.INVENTORY_READ);
        if (intent === 'PROCUREMENT') return permissions.has(RBAC_PERMISSIONS.PROCUREMENT_READ);
        if (intent === 'SERVICE_ORDER_PROGRESS') return permissions.has(RBAC_PERMISSIONS.SOD_READ);
        if (intent === 'CONTRACTORS') return permissions.has(RBAC_PERMISSIONS.CONTRACTOR_READ);
        if (intent === 'STORES') return permissions.has(RBAC_PERMISSIONS.INVENTORY_READ);
        return true;
    }

    /**
     * Fully Dynamic Agentic Loop with Gemini Function Calling
     */
    private static async runAgenticLoop(message: string, history: ChatMessage[], userName: string, permissions: ReadonlySet<string>, opmcScope: NexusOpmcScope, userId?: string): Promise<NexusResponse | null> {
        const hasFinanceAccess = [
            RBAC_PERMISSIONS.FINANCE_READ,
            RBAC_PERMISSIONS.PROJECT_FINANCE_READ,
            RBAC_PERMISSIONS.FINANCE_AUDIT,
        ].some(permission => permissions.has(permission));
        // Step 1: Pre-flight Local AI Routing
        const { intent, confidence } = NexusClassifierService.predictWithConfidence(message);
        
        const msgLowerForChart = message.toLowerCase();
        const wantsChart = msgLowerForChart.includes('chart') || msgLowerForChart.includes('graph') || msgLowerForChart.includes('prastar') || msgLowerForChart.includes('satahan') || msgLowerForChart.includes('plot');
        
        if (confidence > 0.85 && this.canReadIntent(intent, message.toLowerCase(), permissions) && await NexusClassifierService.hasNearExample(message, intent)) {
            
            // Hardcoded zero-cost Local AI static responses for known intents
            if (intent === 'INVENTORY_LOW') {
                const data = await NexusContextService.getInventoryLowStockContext(opmcScope);
                
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
                const data = await NexusContextService.getProjectsContext(opmcScope);
                
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
                const data = await NexusContextService.getProcurementContext(opmcScope);
                
                return {
                    response: `මිලදී ගැනීමේ (Procurement) සාරාංශය:\n\n- Pending PRs (Purchase Requisitions): ${data.pendingPRsCount}\n- Pending POs (Purchase Orders): ${data.pendingPOsCount}\n- Pending GRNs: ${data.pendingGRNsCount}\n- Completed GRNs: ${data.completedGRNsCount}\n\nඅවසන් වරට සම්පූර්ණ කළ GRN එක: ${data.latestCompletedGRN}`,
                    actions: [],
                    suggestions: ['Show pending payment vouchers', 'Check low stock items'],
                };
            }
            if (intent === 'SERVICE_ORDER_PROGRESS') {
                const data = await NexusContextService.getServiceOrderProgressContext(undefined, opmcScope);
                
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
                const data = await NexusContextService.getJobCostingContext(undefined, opmcScope);
                
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
                const data = await NexusContextService.getFinanceContext(opmcScope);
                
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
        } else {
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const modelName = 'gemini-3.5-flash-lite'; // 500 RPD limit model
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

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
                    name: "getExecutiveBrief",
                    description: "One-screen answer to 'how is the company doing' / overview / summary / morning brief: headline cards (revenue, profit, cash, receivables, orders completed, open orders, projects) with change versus the same days of last month, plus the items that need attention. Users limited to an OPMC get the same for their own OPMC.",
                },
                {
                    name: "compareMetric",
                    description: `Compare one business metric between two periods (default: current period versus the previous one of the same length) and optionally split by RTOM to show what drove the change. Metrics: ${METRIC_IDS.join(', ')}. Periods: this_month, last_month, last_7_days, last_30_days, this_week, this_year.`,
                    parameters: {
                        type: "object",
                        properties: {
                            metric: { type: "string", enum: [...METRIC_IDS] },
                            period: { type: "string", enum: ["this_month", "last_month", "last_7_days", "last_30_days", "this_week", "this_year"] },
                            groupBy: { type: "string", enum: ["rtom"], description: "Use when the user asks which RTOM / area / region caused or contributed to the change" }
                        },
                        required: ["metric"]
                    }
                },
                {
                    name: "findAnomalies",
                    description: "Find anything unusual right now: sudden drops or spikes in daily completions, RTOMs whose weekly completions fell sharply, RTOMs with old open orders piling up, and expense or profit problems. Use for 'anything unusual', 'any problems', 'awulak thiyenawada', 'what needs attention'.",
                },
                {
                    name: "projectMetric",
                    description: "Month-end projection of a metric from the pace so far this month, with the accuracy of the same method on past months. Use for 'month end', 'projection', 'forecast', 'how will this month finish', 'masa awasanayata'.",
                    parameters: { type: "object", properties: { metric: { type: "string", enum: METRIC_IDS.filter((m) => m !== 'open_orders') } }, required: ["metric"] }
                },
                {
                    name: "getProfile",
                    description: "Everything about one RTOM or one contractor in one place: completed orders versus last month, open and old orders, revenue, contractors in the RTOM, or a contractor's stock and wastage. Use for 'profile of', 'tell me about', 'drill into', 'R-JA eka gana'.",
                    parameters: { type: "object", properties: { type: { type: "string", enum: ["rtom", "contractor"] }, name: { type: "string", description: "RTOM code such as R-JA, or the contractor's name" } }, required: ["type", "name"] }
                },
                {
                    name: "runCustomReport",
                    description: "Build a custom tabular report from the database when the user asks for a report that the other tools do not cover. Entities and queryable fields: serviceOrder[soNum,status,sltsStatus,customerName,voiceNumber,rtom,completedDate,revenueAmount,createdAt,contractor.name,contractor.status,opmc.name,opmc.rtom,opmc.region,opmc.province]; materialUsage[serviceOrderId,quantity,unit,usageType,costPrice,unitPrice,createdAt,serviceOrder.soNum,serviceOrder.status,serviceOrder.sltsStatus,serviceOrder.rtom,serviceOrder.completedDate,serviceOrder.contractor.name,serviceOrder.opmc.name,serviceOrder.opmc.region,item.code,item.name,item.category,item.type]; contractorStock[quantity,updatedAt,contractor.name,contractor.status,item.code,item.name,item.category]; journalEntry[referenceId,referenceType,description,date,createdAt]; wastage[month,description,status,createdAt,contractor.name,store.name]. Filter operators: equals, contains, gt, lt, gte, lte, startsWith (dates as YYYY-MM-DD). Optional aggregation groups rows and applies SUM, AVG or COUNT to one field. Returns at most 50 rows.",
                    parameters: {
                        type: "object",
                        properties: {
                            entity: { type: "string", enum: ["serviceOrder", "materialUsage", "contractorStock", "journalEntry", "wastage"] },
                            columns: { type: "array", items: { type: "string" } },
                            filters: { type: "array", items: { type: "object", properties: { field: { type: "string" }, operator: { type: "string" }, value: { type: "string" } }, required: ["field", "operator", "value"] } },
                            aggregation: { type: "object", properties: { groupBy: { type: "string" }, targetField: { type: "string" }, type: { type: "string", enum: ["SUM", "AVG", "COUNT"] } } }
                        },
                        required: ["entity", "columns"]
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
0. TODAY'S DATE is ${slDayKey(new Date())} (Sri Lanka time). Use it to turn relative ranges such as "last 30 days" or "this month" into exact YYYY-MM-DD filter values, and state the exact range you used in your reply.
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

CUSTOM REPORTS: if the user asks for a report/list/summary the other tools do not cover, call runCustomReport. The system shows the rows to the user as a table automatically, so do NOT write a markdown table; in "reply" give a short summary (what you filtered, how many rows, one or two notable findings). If it returns an error, tell the user plainly; never invent rows.

NOTE: Only include the "chart" key if the user explicitly asks to visualize, draw a graph, or chart the data. Otherwise, omit it entirely.
`;

        const externalPrivacy = NexusPrivacyService.mode('external');
        const planNote = `

PRIVACY (plan-only): you will NOT be shown any ERP data. Your only job is to pick the tool(s) needed for the CURRENT request and fill in exact arguments (exact YYYY-MM-DD dates and filters). Rules: (1) Call only the tool(s) the current request needs, usually exactly one; never call tools for earlier questions. (2) Prefer runCustomReport for any list, count, sum or "by <field>" request, choosing the entity the user names (service orders -> serviceOrder, contractor stock -> contractorStock, material usage -> materialUsage, wastage -> wastage, journal entries -> journalEntry). (3) If the request needs data no tool can provide (fleet, HR/salary, helpdesk tickets, users, passwords, secrets, deleting or changing data, anything unrelated to the ERP), do NOT call any tool: reply with one short sentence saying that is not available. (4) Do not answer with figures and do not ask for data; the system presents the results itself. Data dictionary: serviceOrder.status values are exactly ${SERVICE_ORDER_STATUSES.join(', ')}; an RTOM (also called area, region or exchange) is a code like R-JA; use the user's own RTOM, contractor and item names exactly as written. Vocabulary (Sinhala/Singlish): gabadu/gabada/ගබඩු = stores (warehouses) -> getStoresContext; thoguwa/තොග = stock; higa/හිඟ = outstanding or low; mudala = money; wada/ව්‍යාපෘති = projects. Tool hints: 'how is the company doing', overview, summary, morning brief, company eka kohomada -> getExecutiveBrief; 'compare', 'vs last month', 'this month vs previous', 'why did it change', which RTOM caused the change -> compareMetric (add groupBy rtom for 'why/which'); anything unusual, any problems, awulak thiyenawada, what needs attention -> findAnomalies; month end, projection, forecast, how will this month finish -> projectMetric; profile of / tell me about / drill into an RTOM (R-JA) or a contractor -> getProfile (type rtom or contractor, name); contractor bills, invoices, payment vouchers, outstanding payments -> getFinanceContext; stores list or count -> getStoresContext; purchase requisitions (PR), purchase orders (PO), GRN -> getProcurementContext; low stock -> getInventoryLowStockContext; registered contractors -> getContractorsContext.
`;
        const planSystemPrompt = systemPrompt + planNote;
        const compatKey = process.env.NEXUS_LLM_API_KEY || process.env.DEEPSEEK_API_KEY;
        const useLocal = process.env.NEXUS_LLM_PROVIDER === 'local' && !!process.env.NEXUS_LLM_BASE_URL;
        if ((compatKey || useLocal) && process.env.NEXUS_LLM_PROVIDER !== 'gemini') {
            try {
                const out = await this.runDeepSeekLoop(compatKey ?? '', useLocal, (!useLocal && externalPrivacy === 'plan-only') ? planSystemPrompt : systemPrompt, history, message, tools[0].functionDeclarations, { permissions, opmcScope, hasFinanceAccess, userId });
                if (out) return this.finalizeReply(out.text, message, out.executedIntent, out.didCheckLowStock, out.table, out.chart, out.cards, out.evidence);
            } catch (error) {
                console.error('[NEXUS] DeepSeek call failed:', error instanceof Error ? error.message : error, (error as { cause?: { code?: string; message?: string } })?.cause?.code ?? (error as { cause?: { message?: string } })?.cause?.message ?? '');
            }
            if (!apiKey) return null;
        }

        const geminiPrivacy = NexusPrivacyService.mode('external');
        const contents: Array<{ role: string; parts: unknown[] }> = [
            ...(geminiPrivacy === 'plan-only' ? [] : history.map((m) => ({ ...m, parts: m.parts.map((p) => ({ text: NexusPrivacyService.maskText(p.text, geminiPrivacy) })) }))),
            { role: 'user', parts: [{ text: NexusPrivacyService.maskText(geminiPrivacy === 'plan-only' ? this.planUserTurn(message, history) : message, geminiPrivacy) }] }
        ];

        // Round 1: Ask Gemini
        let response = await geminiBreaker.execute(() => fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey ?? '' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: geminiPrivacy === 'plan-only' ? planSystemPrompt : systemPrompt }] },
                tools,
                contents
            })
        }));

        if (!response.ok) {
            console.error("[NEXUS] Gemini request failed with status", response.status);
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
        let reportTable: NexusTable | undefined;

        while (functionCalls.length > 0 && iterations < MAX_ITERATIONS) {
            iterations++;
            
            if (geminiPrivacy === 'plan-only') {
                const runs: ToolRun[] = [];
                for (const fc of functionCalls.slice(0, 2)) {
                    const executed = await this.executeTool(fc.name, fc.args, { permissions, opmcScope, hasFinanceAccess, userId });
                    if (executed.intent !== undefined) executedIntent = executed.intent;
                    if (executed.checkedLowStock) didCheckLowStock = true;
                    runs.push({ name: fc.name, args: fc.args, result: executed.result, table: executed.table, executive: executed.executive });
                }
                const local = NexusLocalReplyService.build(runs, message);
                return this.finalizeReply(local.text, message, executedIntent, didCheckLowStock, local.table, local.chart, local.cards, local.evidence);
            }

            // Push the exact model response to history (preserves thought_signature)
            contents.push(data.candidates[0].content);

            const functionResponses: Array<{ functionResponse: { name: string; id?: string; response: { name: string; content: Record<string, unknown> | unknown } } }> = [];

            for (const fc of functionCalls) {
                const funcName = fc.name;
                const executed = await this.executeTool(funcName, fc.args, { permissions, opmcScope, hasFinanceAccess, userId });
                const funcResult = NexusPrivacyService.forModel(funcName, executed.result, geminiPrivacy);
                if (executed.intent !== undefined) executedIntent = executed.intent;
                if (executed.checkedLowStock) didCheckLowStock = true;
                if (executed.table) reportTable = executed.table;

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
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey ?? '' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    tools,
                    contents
                })
            }));

            if (!response.ok) {
                    console.error("[NEXUS] Gemini tool request failed with status", response.status);
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
            return null;
        }
        return this.finalizeReply(textReply, message, executedIntent, didCheckLowStock, reportTable);
    }

    /** Turns the model's final text into the response the UI expects (shared by every provider). */
    private static async finalizeReply(textReply: string, message: string, executedIntent: string | null, didCheckLowStock: boolean, table?: NexusTable, localChart?: NexusChart, cards?: NexusCard[], evidence?: string): Promise<NexusResponse> {
        // Automatic self-training from the model's own tool choices is disabled: a wrong choice taught the
        // classifier wrong intents (observed in testing). Only explicit user feedback trains it now.
        let parsedReply = textReply;
        let suggestions = ["Show active projects status", "List current low stock items"];
        let actions: NexusAction[] = [];
        let chart: NexusChart | undefined = localChart;

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
            chart,
            table,
            cards,
            evidence
        };
    }

    /**
     * Custom report tool. Same whitelist as the admin report builder, plus: each entity needs its module
     * capability, cost/revenue columns need the finance/cost capability, and users limited to specific
     * OPMCs may only report on entities that can be scoped to those OPMCs (the scope is injected here).
     */
    private static async runCustomReportTool(args: Record<string, unknown> | undefined, permissions: ReadonlySet<string>, opmcScope: NexusOpmcScope) {
        const entity = String(args?.entity ?? '') as DynamicReportPayload['entity'];
        const columns = Array.isArray(args?.columns) ? (args!.columns as unknown[]).map(String) : [];
        const filters = (Array.isArray(args?.filters) ? args!.filters as FilterRule[] : []).map((f) => ({ field: String(f.field), operator: f.operator, value: String(f.value) }));
        const agg = args?.aggregation as AggregationConfig | undefined;
        const aggregation = agg && agg.groupBy && agg.targetField && agg.type ? { groupBy: String(agg.groupBy), targetField: String(agg.targetField), type: agg.type } : undefined;

        const entityPermission: Record<string, string> = {
            serviceOrder: RBAC_PERMISSIONS.SOD_READ,
            materialUsage: RBAC_PERMISSIONS.SOD_READ,
            contractorStock: RBAC_PERMISSIONS.INVENTORY_READ,
            wastage: RBAC_PERMISSIONS.INVENTORY_READ,
            journalEntry: RBAC_PERMISSIONS.FINANCE_READ,
        };
        const required = entityPermission[entity];
        if (!required || !permissions.has(required)) return { error: 'You do not have access to this report.' };

        const used = [...columns, ...filters.map((f) => f.field), ...(aggregation ? [aggregation.groupBy, aggregation.targetField] : [])];
        if (used.some((f) => f === 'revenueAmount') && !permissions.has(RBAC_PERMISSIONS.FINANCE_READ)) return { error: 'Revenue figures require finance access.' };
        if (used.some((f) => f === 'costPrice' || f === 'unitPrice') && !permissions.has(RBAC_PERMISSIONS.INVENTORY_COST_READ)) return { error: 'Cost figures require inventory cost access.' };

        let scopeWhere: Record<string, unknown> | undefined;
        if (opmcScope !== undefined) {
            if (entity === 'serviceOrder') scopeWhere = { opmcId: { in: [...opmcScope] } };
            else if (entity === 'materialUsage') scopeWhere = { serviceOrder: { opmcId: { in: [...opmcScope] } } };
            else return { error: 'This report is only available to users with company-wide access.' };
        }

        try {
            // Semantic layer: every name or value is checked against real data before the query runs
            const grounded = await groundReportFilters(entity, filters, opmcScope);
            if (grounded.issue) return { error: grounded.issue };
            const report = await DynamicReportService.generateReport({ entity, columns, filters: grounded.filters, aggregation }, { scopeWhere, opmcIds: opmcScope });
            const search = describeSearch({
                entity, filters: grounded.filters, groupBy: aggregation?.groupBy, rows: report.rows.length, capped: report.capped, asOf: new Date(),
                scope: opmcScope === undefined ? undefined : 'limited to your OPMC',
            }) + ((report as { verified?: boolean }).verified ? ' · ✓ totals reconciled' : '') + (grounded.evidence.length ? ` · ${grounded.evidence.join('; ')}` : '');
            return { type: report.type, columns: report.columns, totalRows: report.rows.length, rows: report.rows.slice(0, 50), truncated: report.rows.length > 50 || report.capped, capped: report.capped, search };
        } catch (error) {
            // Only our own validation messages are shown; database/Prisma errors can contain internal paths and queries.
            const known = error instanceof Error && /^(INVALID_ENTITY|INVALID_COLUMN|INVALID_FILTER|INVALID_AGGREGATION)/.test(error.message);
            if (!known) console.error('[NEXUS] Custom report failed:', error instanceof Error ? error.message.trim().split(/\r?\n/).filter(Boolean).slice(-4).join(' | ') : error);
            return { error: known ? (error as Error).message : 'The report could not be built with those filters. Check the field names, operators and values.' };
        }
    }


    /**
     * Same tools, permission and OPMC checks as the Gemini path, driven through DeepSeek's OpenAI-compatible
     * chat API. The key comes only from the DEEPSEEK_API_KEY environment variable.
     */
    private static async runDeepSeekLoop(
        apiKey: string,
        useLocal: boolean,
        systemPrompt: string,
        history: ChatMessage[],
        message: string,
        declarations: Array<{ name: string; description: string; parameters?: unknown }>,
        ctx: { permissions: ReadonlySet<string>; opmcScope: NexusOpmcScope; hasFinanceAccess: boolean; userId?: string },
    ): Promise<{ text: string; executedIntent: string | null; didCheckLowStock: boolean; table?: NexusTable; chart?: NexusChart; cards?: NexusCard[]; evidence?: string } | null> {
        // Any OpenAI-compatible server works: DeepSeek (default), or a model on our own server (Ollama, vLLM)
        // by setting NEXUS_LLM_PROVIDER=local and NEXUS_LLM_BASE_URL, in which case data never leaves our network.
        const baseUrl = (useLocal ? process.env.NEXUS_LLM_BASE_URL! : (process.env.NEXUS_LLM_BASE_URL || 'https://api.deepseek.com')).replace(/\/+$/, '');
        const model = process.env.NEXUS_LLM_MODEL || process.env.DEEPSEEK_MODEL || (useLocal ? 'llama3.1' : 'deepseek-chat');
        const privacy: PrivacyMode = NexusPrivacyService.mode(useLocal ? 'local' : 'external');
        const tools = declarations.map((d) => ({
            type: 'function',
            function: { name: d.name, description: d.description, parameters: d.parameters ?? { type: 'object', properties: {} } },
        }));
        const messages: Array<Record<string, unknown>> = [
            { role: 'system', content: systemPrompt },
            ...(privacy === 'plan-only' ? [] : history.slice(-20).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: NexusPrivacyService.maskText(m.parts?.[0]?.text ?? '', privacy) }))),
            { role: 'user', content: NexusPrivacyService.maskText(privacy === 'plan-only' ? this.planUserTurn(message, history) : message, privacy) },
        ];
        let executedIntent: string | null = null;
        let didCheckLowStock = false;
        let table: NexusTable | undefined;

        for (let round = 0; round < 4; round++) {
            const res = await deepseekBreaker.execute(() => fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
                body: JSON.stringify({ model, messages, tools, temperature: 0.2 }),
                signal: AbortSignal.timeout(45_000),
            }));
            if (!res.ok) {
                console.error('[NEXUS] DeepSeek request failed with status', res.status);
                return null;
            }
            const data = await res.json();
            const msg = data.choices?.[0]?.message as { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments?: string } }> } | undefined;
            if (!msg) return null;
            if (msg.tool_calls?.length && privacy === 'plan-only') {
                // The model has chosen the tools. Run them here and build the answer locally: nothing goes back to the model.
                const runs: ToolRun[] = [];
                for (const call of msg.tool_calls.slice(0, 2)) {
                    let args: Record<string, unknown> | undefined;
                    try { args = call.function.arguments ? JSON.parse(call.function.arguments) : undefined; } catch { args = undefined; }
                    const executed = await this.executeTool(call.function.name, args, ctx);
                    if (executed.intent !== undefined) executedIntent = executed.intent;
                    if (executed.checkedLowStock) didCheckLowStock = true;
                    runs.push({ name: call.function.name, args, result: executed.result, table: executed.table, executive: executed.executive });
                }
                const local = NexusLocalReplyService.build(runs, message);
                return { text: local.text, executedIntent, didCheckLowStock, table: local.table, chart: local.chart, cards: local.cards, evidence: local.evidence };
            }
            if (msg.tool_calls?.length) {
                messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls });
                for (const call of msg.tool_calls) {
                    let args: Record<string, unknown> | undefined;
                    try { args = call.function.arguments ? JSON.parse(call.function.arguments) : undefined; } catch { args = undefined; }
                    const executed = await this.executeTool(call.function.name, args, ctx);
                    if (executed.intent !== undefined) executedIntent = executed.intent;
                    if (executed.checkedLowStock) didCheckLowStock = true;
                    if (executed.table) table = executed.table;
                    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(NexusPrivacyService.forModel(call.function.name, executed.result, privacy)).slice(0, 30_000) });
                }
                continue;
            }
            return msg.content ? { text: msg.content, executedIntent, didCheckLowStock, table } : null;
        }
        return null;
    }


    /**
     * Plan-only user turn: the current request, plus at most the previous question as a reference for follow-ups
     * ("and for R-HO?"). Earlier questions are never sent as separate turns, because the model then re-runs them.
     */
    private static planUserTurn(message: string, history: ChatMessage[]): string {
        const previous = [...history].reverse().find((m) => m.role === 'user')?.parts?.[0]?.text?.slice(0, 300);
        return previous
            ? `CURRENT REQUEST (handle only this): ${message}

(For reference only, the user's previous question was: "${previous}". It is already answered; do not run it again.)`
            : `CURRENT REQUEST (handle only this): ${message}`;
    }

    /** Runs one assistant tool for the caller. Shared by every model provider so permission and scope checks live in one place. */
    private static async executeTool(
        funcName: string,
        args: Record<string, unknown> | undefined,
        ctx: { permissions: ReadonlySet<string>; opmcScope: NexusOpmcScope; hasFinanceAccess: boolean; userId?: string },
    ): Promise<{ result: unknown; intent?: string | null; checkedLowStock?: boolean; table?: NexusTable; executive?: { cards: NexusCard[]; table?: NexusTable } }> {
        const { permissions, opmcScope, hasFinanceAccess, userId } = ctx;
        let result: unknown = {};
        let intent: string | null | undefined;
        let checkedLowStock = false;
        let table: NexusTable | undefined;
        let executive: { cards: NexusCard[]; table?: NexusTable } | undefined;
                if (funcName === 'getFinanceContext' && hasFinanceAccess) {
                    result = await NexusContextService.getFinanceContext(opmcScope);
                    intent = 'FINANCE';
                } else if (funcName === 'getProjectsContext' && permissions.has(RBAC_PERMISSIONS.PROJECT_READ)) {
                    result = await NexusContextService.getProjectsContext(opmcScope);
                    intent = 'PROJECTS';
                } else if (funcName === 'getInventoryLowStockContext' && permissions.has(RBAC_PERMISSIONS.INVENTORY_READ)) {
                    checkedLowStock = true;
                    result = await NexusContextService.getInventoryLowStockContext(opmcScope);
                    intent = 'INVENTORY_LOW';
                } else if (funcName === 'getContractorsContext' && permissions.has(RBAC_PERMISSIONS.CONTRACTOR_READ)) {
                    result = await NexusContextService.getContractorsContext(opmcScope);
                    intent = 'CONTRACTORS';
                } else if (funcName === 'getStoresContext' && permissions.has(RBAC_PERMISSIONS.INVENTORY_READ)) {
                    result = await NexusContextService.getStoresContext(opmcScope);
                    intent = 'STORES';
                } else if (funcName === 'getProcurementContext' && permissions.has(RBAC_PERMISSIONS.PROCUREMENT_READ)) {
                    result = await NexusContextService.getProcurementContext(opmcScope);
                    intent = 'PROCUREMENT';
                } else if (funcName === 'getBOMInvoicesContext' && hasFinanceAccess) {
                    result = await NexusContextService.getBOMInvoicesContext(opmcScope);
                    intent = 'BOM_INVOICES';
                } else if (funcName === 'getServiceOrderProgressContext' && permissions.has(RBAC_PERMISSIONS.SOD_READ)) {
                    const sArgs = args as Record<string, string> | undefined;
                    result = await NexusContextService.getServiceOrderProgressContext(sArgs?.opmcCode, opmcScope);
                    // Service order maps loosely to projects or a new intent, skipping mapping for simplicity
                } else if (funcName === 'getJobCostingContext' && hasFinanceAccess) {
                    const sArgs = args as Record<string, string> | undefined;
                    result = await NexusContextService.getJobCostingContext(sArgs, opmcScope);
                    intent = 'JOB_COSTING';
                } else if (funcName === 'getExecutiveBrief') {
                    result = await ExecutiveMetricService.brief(permissions, opmcScope, userId);
                    intent = null;
                    const b = result as { cards?: NexusCard[]; table?: NexusTable; error?: string };
                    if (!b.error) { executive = { cards: b.cards ?? [], table: b.table }; }
                } else if (funcName === 'compareMetric') {
                    const metric = String(args?.metric ?? '') as MetricId;
                    result = await ExecutiveMetricService.compare(metric, args?.period ? String(args.period) : undefined, args?.groupBy ? String(args.groupBy) : undefined, permissions, opmcScope);
                    intent = null;
                    if (!('error' in (result as object))) {
                        const cmp = result as Parameters<typeof ExecutiveMetricService.card>[0];
                        executive = { cards: [ExecutiveMetricService.card(cmp)], table: ExecutiveMetricService.table(cmp) };
                    }
                } else if (funcName === 'findAnomalies' || funcName === 'projectMetric' || funcName === 'getProfile') {
                    intent = null;
                    const r = funcName === 'findAnomalies'
                        ? await ExecutiveInsightService.anomalies(permissions, opmcScope)
                        : funcName === 'projectMetric'
                            ? await ExecutiveInsightService.project(String(args?.metric ?? '') as MetricId, permissions, opmcScope)
                            : await ExecutiveInsightService.profile(String(args?.type ?? ''), String(args?.name ?? ''), permissions, opmcScope);
                    result = r;
                    if (!('error' in r)) executive = { cards: r.cards, table: (r as { table?: NexusTable }).table };
                } else if (funcName === 'runCustomReport') {
                    result = await this.runCustomReportTool(args, permissions, opmcScope);
                    intent = null;
                    const rep = result as { error?: string; columns?: string[]; rows?: Record<string, unknown>[]; totalRows?: number; truncated?: boolean; capped?: boolean };
                    if (!rep.error && rep.columns && rep.rows) {
                        table = { title: `Custom report: ${String(args?.entity ?? '')}`, columns: rep.columns, rows: rep.rows, totalRows: rep.totalRows ?? rep.rows.length, truncated: !!rep.truncated, capped: !!rep.capped };
                    }
                } else {
                    result = { error: "Unauthorized or unknown function." };
                }

        return { result, intent, checkedLowStock, table: table ?? executive?.table, executive };
    }
}
