import { prisma } from '@/lib/prisma';

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export class NexusMemoryService {
  /**
   * Retrieve conversation history for a user
   */
  static async getConversation(userId: string): Promise<ChatMessage[]> {
    const record = await prisma.nexusConversation.findFirst({
      where: { userId }
    });

    if (!record || !record.messages) return [];
    return record.messages as unknown as ChatMessage[];
  }

  /**
   * Save one question and its answer. Keeps the latest 20 exchanges (40 messages) per user.
   */
  static async appendTurn(userId: string, userText: string, modelText: string) {
    const clip = (t: string) => t.slice(0, 4000);
    const turn: ChatMessage[] = [
      { role: 'user', parts: [{ text: clip(userText) }] },
      { role: 'model', parts: [{ text: clip(modelText) }] },
    ];
    const record = await prisma.nexusConversation.findFirst({ where: { userId } });
    if (!record) {
      await prisma.nexusConversation.create({ data: { userId, messages: turn as unknown as object } });
      return;
    }
    const previous = Array.isArray(record.messages) ? (record.messages as unknown as ChatMessage[]) : [];
    await prisma.nexusConversation.update({
      where: { id: record.id },
      data: { messages: [...previous, ...turn].slice(-40) as unknown as object },
    });
  }

  /**
   * Clear user's conversation memory
   */
  static async clearConversation(userId: string) {
    const record = await prisma.nexusConversation.findFirst({
      where: { userId }
    });

    if (record) {
      return prisma.nexusConversation.delete({
        where: { id: record.id }
      });
    }
  }

  /**
   * Extract user's most frequent or recent queries to build dynamic suggestion buttons
   */
  static async getFrequentSuggestions(userId: string): Promise<string[]> {
    const history = await this.getConversation(userId);
    const userQueries = history
      .filter(m => m.role === 'user')
      .map(m => m.parts?.[0]?.text?.trim())
      .filter((text): text is string => typeof text === 'string' && text.length > 0);

    const counts: Record<string, number> = {};
    for (const q of userQueries) {
      counts[q] = (counts[q] || 0) + 1;
    }

    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    const defaults = [
      "Low stock materials monawada?",
      "how many registered contractors?",
      "gabadu gana kiyada?",
      "total materials info danna?",
      "pending requisitions kiyada?",
      "Pending Payment Vouchers monawada?"
    ];

    const combined = Array.from(new Set([...sorted, ...defaults]));
    return combined.slice(0, 5);
  }
}
