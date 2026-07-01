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
          messages: prunedHistory as any,
          updatedAt: new Date()
        }
      });
    } else {
      return prisma.nexusConversation.create({
        data: {
          userId,
          messages: prunedHistory as any
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
}
