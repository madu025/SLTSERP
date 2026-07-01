import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
   * Append a message to the user's conversation history
   */
  static async saveMessage(userId: string, role: 'user' | 'model', text: string) {
    const history = await this.getConversation(userId);
    
    // Append new message
    history.push({
      role,
      parts: [{ text }]
    });

    // Keep only last 15 messages to control context window and token usage
    const prunedHistory = history.slice(-15);

    const record = await prisma.nexusConversation.findFirst({
      where: { userId }
    });

    if (record) {
      return prisma.nexusConversation.update({
        where: { id: record.id },
        data: {
          messages: prunedHistory as unknown as Prisma.InputJsonValue,
          updatedAt: new Date()
        }
      });
    } else {
      return prisma.nexusConversation.create({
        data: {
          userId,
          messages: prunedHistory as unknown as Prisma.InputJsonValue
        }
      });
    }
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
