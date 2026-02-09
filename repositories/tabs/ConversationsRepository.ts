import { conversationsDataSource, Conversation } from "@/datasources/remote/firebase/conversationsDataSource";
import { Unsubscribe } from "firebase/firestore";

export class ConversationsRepository {
  /**
   * Fetch all conversations for a user (one-time fetch)
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    return conversationsDataSource.fetchConversations(userId);
  }

  /**
   * Subscribe to real-time conversation updates
   * Returns an unsubscribe function
   */
  subscribeToConversations(
    userId: string, 
    callback: (conversations: Conversation[]) => void
  ): Unsubscribe {
    return conversationsDataSource.subscribeToConversations(userId, callback);
  }
}

export type { Conversation };
