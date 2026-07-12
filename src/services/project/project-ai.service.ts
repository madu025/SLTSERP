import { primaryClient as prisma } from '@/lib/prisma';

interface GeminiResponse {
    candidates?: {
        content?: {
            parts?: {
                text?: string;
            }[];
        };
    }[];
}

export class ProjectAIService {
  
  // 1. AI Predictive Risk & Delay Warning
  static async predictProjectRisks(projectId: string) {
    const evm = await prisma.projectEVM.findUnique({
      where: { projectId }
    });

    const risks: string[] = [];
    let spi = 1.0;
    let cpi = 1.0;

    if (evm) {
      const pvTotal = Number(evm.pvTotal) || 0;
      const evTotal = Number(evm.evTotal) || 0;
      const acTotal = Number(evm.acTotal) || 0;
      
      if (pvTotal > 0) spi = evTotal / pvTotal;
      if (acTotal > 0) cpi = evTotal / acTotal;

      if (spi < 0.85) {
        risks.push(`🔴 CRITICAL SCHEDULE RISK: Project is significantly behind schedule (SPI: ${spi.toFixed(2)}). Immediate intervention required.`);
      } else if (spi < 0.95) {
        risks.push(`🟡 SCHEDULE WARNING: Project is slightly behind schedule (SPI: ${spi.toFixed(2)}).`);
      }

      if (cpi < 0.85) {
        risks.push(`🔴 CRITICAL BUDGET RISK: Project is significantly over budget (CPI: ${cpi.toFixed(2)}).`);
      } else if (cpi < 0.95) {
        risks.push(`🟡 BUDGET WARNING: Project is slightly over budget (CPI: ${cpi.toFixed(2)}).`);
      }
    }

    // Check critical path tasks delayed
    const delayedTasks = await prisma.projectTask.count({
      where: {
        projectId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        plannedEndDate: { lt: new Date() }
      }
    });

    if (delayedTasks > 0) {
      risks.push(`🔴 TASK DELAY RISK: ${delayedTasks} critical tasks have already missed their planned end dates.`);
    }

    return { spi, cpi, risks };
  }

  // 2. Smart Material Forecasting
  static async forecastMaterialShortages(projectId: string) {
    const boqItems = await prisma.projectBOQItem.findMany({
      where: { projectId, source: 'EXISTING' },
      include: { material: { include: { stocks: true } } }
    });

    const shortages = [];

    for (const item of boqItems) {
      if (!item.material) continue;
      
      const requiredQty = Number(item.quantity);
      const currentStock = item.material.stocks.reduce((sum: number, s: { quantity: { toString(): string } }) => sum + Number(s.quantity.toString()), 0);

      if (currentStock < requiredQty) {
        shortages.push({
          itemCode: item.material.code,
          itemName: item.material.name,
          required: requiredQty,
          available: currentStock,
          shortage: requiredQty - currentStock,
          alert: `⚠️ MATERIAL SHORTAGE PREDICTED: Requires ${requiredQty} units of ${item.material.name}, but only ${currentStock} available in inventory.`
        });
      }
    }

    return shortages;
  }

  // 3. Smart Resource & Contractor Allocation
  static async recommendResourceAllocation(taskId: string) {
    const task = await prisma.projectTask.findUnique({
      where: { id: taskId }
    });
    if (!task) throw new Error("Task not found");

    // Fetch all active contractors
    const contractors = await prisma.contractor.findMany({
      where: { status: 'ACTIVE' }
    });

    if (contractors.length === 0) return null;

    const workloads = await Promise.all(contractors.map(async (c: { id: string; name: string }) => {
      const activeCount = await prisma.projectTask.count({
        where: { assigneeType: 'CONTRACTOR', assigneeId: c.id, status: { in: ['PENDING', 'IN_PROGRESS'] } }
      });
      return { contractor: c, count: activeCount };
    }));

    // Sort by lowest active task count
    workloads.sort((a: { count: number }, b: { count: number }) => a.count - b.count);
    const recommended = workloads[0];

    return {
      recommendedContractorId: recommended.contractor.id,
      recommendedContractorName: recommended.contractor.name,
      activeTasksLoad: recommended.count,
      reason: `AI recommends ${recommended.contractor.name} as they currently have the lowest workload (${recommended.count} active tasks) across all active contractors.`
    };
  }

  // Helper: Call Gemini
  private static async askGeminiInternal(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "API key missing for Generative AI.";

    try {
      const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
          })
        }
      );
      if (response.ok) {
        const data = (await response.json()) as GeminiResponse;
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate.";
      }
      return "Gemini API failed to respond.";
    } catch {
      return "Gemini API error.";
    }
  }

  // 4. Generative Project Health Report
  static async generateProjectHealthReport(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("Project not found");

    const riskData = await this.predictProjectRisks(projectId);
    const materialData = await this.forecastMaterialShortages(projectId);

    const context = `
      Project Name: ${project.name}
      Status: ${project.status}
      SPI: ${riskData.spi.toFixed(2)}
      CPI: ${riskData.cpi.toFixed(2)}
      Identified Risks: ${riskData.risks.join(' | ')}
      Material Shortages: ${materialData.map(m => m.alert).join(' | ')}
    `;

    const prompt = `
      You are the Project Management AI for SLTS ERP. Analyze this raw project data and generate a clear, concise 3-paragraph executive health report in professional Sinhala.
      Paragraph 1: General Status & EVM performance.
      Paragraph 2: Material Shortages (if any, otherwise state inventory is sufficient).
      Paragraph 3: Key risks and recommendations.
      Data: ${context}
    `;

    return await this.askGeminiInternal(prompt);
  }

  // 5. Smart Change Order Impact Analysis
  static async analyzeChangeOrderImpact(changeOrderId: string) {
    const co = await prisma.projectChangeOrder.findUnique({
      where: { id: changeOrderId },
      include: { project: true }
    });
    if (!co) throw new Error("Change Order not found");

    const prompt = `
      You are an AI Impact Analyst for SLTS ERP.
      Change Order Request: ${co.reason}
      Cost Impact: LKR ${co.costImpact}
      Time Impact: ${co.timeImpact} days
      Status: ${co.status}
      
      Write a short risk and impact summary for the Approving Manager explaining whether this change is financially and temporally safe to approve, in professional English. Be concise (max 3 sentences).
    `;

    return await this.askGeminiInternal(prompt);
  }
}
