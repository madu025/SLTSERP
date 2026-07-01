import { primaryClient as prisma } from '@/lib/prisma';
import { AssetCustodyService } from './inventory/asset-custody.service';
import { StockRequestService } from './inventory/stock-request.service';
import { NexusContextService } from './nexus-context.service';

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
    static async ask(message: string, userId: string): Promise<{ response: string; actions?: NexusAction[] }> {
        const context = await this.getSystemContext();
        const apiKey = process.env.GEMINI_API_KEY;
        const { NexusMemoryService } = await import('./nexus-memory.service');

        const selfHealing = await this.getSelfHealingProposals();
        const actions: NexusAction[] = [];

        // Load conversation history
        const history = await NexusMemoryService.getConversation(userId);

        // System prompt outlining agent personality & live statistics context
        const systemPrompt = `
You are "Nexus Agent", the intelligent global AI assistant of SLTS Nexus ERP.
Your task is to help the user manage inventory, track assets, see low stock, check expiring batches, check payment vouchers, track project status, manage users, and run database operations.
You must be fully compatible with all ERP modules.

Current Live ERP Database Context:
- Inventory:
  * Total Items: ${context.inventory.itemsCount}
  * Active Stores: ${context.inventory.storesCount}
  * Low Stock detected: ${JSON.stringify(context.inventory.lowStock)}
  * Expiring Batches: ${JSON.stringify(context.inventory.expiringBatches)}
  * Serialized Assets: ${JSON.stringify(context.inventory.custodyAssets)}
- Projects:
  * Active Projects: ${context.projects.activeProjectsCount}
  * Overdue Tasks Count: ${context.projects.overdueTasksCount}
  * Active Progress details: ${JSON.stringify(context.projects.atRiskProjects)}
- Finance:
  * Total Outstanding Contractor Invoices: LKR ${context.finance.outstandingInvoicesSum.toLocaleString()}
  * Payment Vouchers pending approval count: ${context.finance.pendingPVsCount}
  * Retention HELD: LKR ${context.finance.totalRetentionHeld.toLocaleString()}
  * Levied Active Penalties: LKR ${context.finance.activePenaltiesSum.toLocaleString()}
- Procurement:
  * Open PRs count: ${context.procurement.pendingPRsCount}
  * Pending PO Approvals count: ${context.procurement.pendingPOsCount}
  * Pending GRNs count: ${context.procurement.pendingGRNsCount}

Self-Healing Stock Proposals (If any store has low stock and another has excess, recommend a transfer):
${JSON.stringify(selfHealing)}

Rules:
1. Always be polite, professional, and clear.
2. If the user asks in Sinhala, reply in natural Sinhala. If in English, reply in English.
3. Highlight any critical stats (overdue invoices, pending voucher approvals, or overdue tasks) if they ask about the overall state.
`;

        if (apiKey) {
            try {
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            systemInstruction: {
                                parts: [{ text: systemPrompt }]
                            },
                            contents: [
                                ...history,
                                {
                                    role: 'user',
                                    parts: [
                                        { text: message }
                                    ]
                                }
                            ],
                            tools: [
                                {
                                    functionDeclarations: [
                                        {
                                            name: "assign_asset_custody",
                                            description: "Assign custody of a serialized item (e.g. laptop, mobile) to a staff member by name/code and serial number",
                                            parameters: {
                                                type: "OBJECT",
                                                properties: {
                                                    serialNumber: { type: "STRING", description: "The exact serial number of the asset" },
                                                    staffNameOrCode: { type: "STRING", description: "Staff member's name or employee code" }
                                                },
                                                required: ["serialNumber", "staffNameOrCode"]
                                            }
                                        },
                                        {
                                            name: "propose_stock_transfer",
                                            description: "Move/transfer inventory item stock between two stores",
                                            parameters: {
                                                type: "OBJECT",
                                                properties: {
                                                    itemCodeOrName: { type: "STRING", description: "The inventory item name or item code" },
                                                    fromStoreName: { type: "STRING", description: "Source inventory store name" },
                                                    toStoreName: { type: "STRING", description: "Destination inventory store name" },
                                                    quantity: { type: "NUMBER", description: "Quantity of items to transfer" }
                                                },
                                                required: ["itemCodeOrName", "fromStoreName", "toStoreName", "quantity"]
                                            }
                                        },
                                        {
                                            name: "create_user",
                                            description: "Create a new ERP user in the system with username, name, password, role, and OPMC/RTOM code",
                                            parameters: {
                                                type: "OBJECT",
                                                properties: {
                                                    username: { type: "STRING", description: "Desired unique username" },
                                                    name: { type: "STRING", description: "User's full display name" },
                                                    password: { type: "STRING", description: "Initial login password" },
                                                    role: { type: "STRING", description: "User role, e.g. ADMIN, ENGINEER" },
                                                    rtomCode: { type: "STRING", description: "RTOM code like MD, Galle" }
                                                },
                                                required: ["username", "name", "password", "role"]
                                            }
                                        }
                                    ]
                                }
                            ]
                        })
                    }
                );

                if (response.ok) {
                    const json = await response.json();
                    const candidate = json.candidates?.[0];
                    const functionCall = candidate?.content?.parts?.[0]?.functionCall;

                    if (functionCall) {
                        const { name, args } = functionCall;

                        if (name === "assign_asset_custody") {
                            const action = await this.lookupAssetCustody(args.serialNumber, args.staffNameOrCode);
                            if (action) {
                                const responseMsg = `I found the asset ${action.itemName} (${action.serialNumber}) and staff member ${action.staffName}. Click confirm below to assign custody.`;
                                await NexusMemoryService.saveMessage(userId, 'user', message);
                                await NexusMemoryService.saveMessage(userId, 'model', responseMsg);
                                return {
                                    response: responseMsg,
                                    actions: [action]
                                };
                            } else {
                                const responseMsg = `I attempted to assign custody for serial "${args.serialNumber}" to "${args.staffNameOrCode}", but could not locate them in the database. Please verify details.`;
                                await NexusMemoryService.saveMessage(userId, 'user', message);
                                await NexusMemoryService.saveMessage(userId, 'model', responseMsg);
                                return {
                                    response: responseMsg,
                                    actions: []
                                };
                            }
                        }

                        if (name === "propose_stock_transfer") {
                            const action = await this.lookupStockTransfer(args.itemCodeOrName, args.fromStoreName, args.toStoreName, args.quantity);
                            if (action) {
                                const responseMsg = `I have prepared a proposal to transfer ${action.quantity} units of ${action.itemName} from ${action.fromStoreName} to ${action.toStoreName}. Click confirm below to request transfer.`;
                                await NexusMemoryService.saveMessage(userId, 'user', message);
                                await NexusMemoryService.saveMessage(userId, 'model', responseMsg);
                                return {
                                    response: responseMsg,
                                    actions: [action]
                                };
                            } else {
                                const responseMsg = `I was unable to propose a stock transfer for "${args.itemCodeOrName}" from "${args.fromStoreName}" to "${args.toStoreName}". Please check item and store names.`;
                                await NexusMemoryService.saveMessage(userId, 'user', message);
                                await NexusMemoryService.saveMessage(userId, 'model', responseMsg);
                                return {
                                    response: responseMsg,
                                    actions: []
                                };
                            }
                        }

                        if (name === "create_user") {
                            const action = await this.lookupCreateUser(args.username, args.name, args.password, args.role, args.rtomCode);
                            if (action) {
                                const responseMsg = `I have prepared a proposal to create a new user "${action.username}" (${action.itemName}) as ${action.role} at OPMC ${action.rtomCode || 'Default'}. Click confirm below to register.`;
                                await NexusMemoryService.saveMessage(userId, 'user', message);
                                await NexusMemoryService.saveMessage(userId, 'model', responseMsg);
                                return {
                                    response: responseMsg,
                                    actions: [action]
                                };
                            }
                        }
                    }

                    const text = candidate?.content?.parts?.[0]?.text;
                    if (text) {
                        if (selfHealing.length > 0) {
                            actions.push(...selfHealing.slice(0, 2));
                        }
                        await NexusMemoryService.saveMessage(userId, 'user', message);
                        await NexusMemoryService.saveMessage(userId, 'model', text);
                        return { response: text, actions };
                    }
                }
            } catch (err) {
                console.error("Gemini API call failed:", err);
            }
        }

        // --- FALLBACK INTERPRETER ---
        const query = message.toLowerCase();

        // 1. Finance outstanding queries
        if (query.includes('outstanding') || query.includes('invoice') || query.includes('payables') || query.includes('ඉන්වොයිසි')) {
            return {
                response: `පද්ධතියේ දැනට පවතින මුළු හිඟ Contractor Invoices වටිනාකම **LKR ${context.finance.outstandingInvoicesSum.toLocaleString()}** කි. පූර්ණ අනුමැතිය ලැබෙන තෙක් බලාපොරොත්තුවෙන් පවතින Payment Vouchers ගණන **${context.finance.pendingPVsCount}** කි.`,
                actions
            };
        }

        // 2. Project delays queries
        if (query.includes('project') || query.includes('overdue') || query.includes('delay') || query.includes('ප්‍රමාද')) {
            return {
                response: `ක්‍රියාත්මක වන ව්‍යාපෘති ගණන **${context.projects.activeProjectsCount}** කි. ඒ අතරින් දැනට නියමිත දින ඉක්මවා ප්‍රමාද වී ඇති Tasks ප්‍රමාණය **${context.projects.overdueTasksCount}** කි.`,
                actions
            };
        }

        // 3. Low stock queries
        if (query.includes('low') || query.includes('stok') || query.includes('stock') || query.includes('අඩු')) {
            if (context.inventory.lowStock.length === 0) {
                return { response: `ගබඩාවේ දැනට අවම සීමාවට වඩා අඩු වූ (Low Stock) කිසිදු උපකරණයක් නොමැත.`, actions };
            }
            const itemsList = context.inventory.lowStock
                .map((s: any) => `- ${s.itemName} (${s.itemCode}) in ${s.storeName}: Current ${s.qty} (Min: ${s.min})`)
                .join('\n');
            
            let selfHealText = '';
            if (selfHealing.length > 0) {
                actions.push(...selfHealing.slice(0, 2));
                selfHealText = `\n\n💡 **ස්වයං-සුවපත් කිරීමේ යෝජනාව (Self-Healing Proposal):**\n` + 
                    selfHealing.map(p => `- ${p.fromStoreName} හි අතිරික්තයෙන් ${p.quantity} ක් ${p.toStoreName} වෙත මාරු කර ${p.itemName} හිඟය පියවිය හැක.`).join('\n');
            }

            return {
                response: `දැනට පද්ධතියේ හඳුනාගත් අවම මට්ටමේ පවතින උපකරණ ලැයිස්තුව (Low Stock):\n\n${itemsList}${selfHealText}`,
                actions
            };
        }

        return {
            response: `ආයුබෝවන්! මම **Nexus AI Agent**. මට ඔබට Inventory, Projects, Finance, සහ Procurement ආශ්‍රිත සියලුම metric දත්ත ලබා දිය හැක. උදාහරණ: 
- "low stock items මොනවාද?"
- "pending payment vouchers කොච්චර තියෙනවද?"
- "overdue tasks මොනවාද?"`,
            actions
        };
    }
}
