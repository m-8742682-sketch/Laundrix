import { 
  conversationsDataSource, 
  Conversation 
} from "@/datasources/remote/firebase/conversationsDataSource";
import { Unsubscribe } from "firebase/firestore";

// Re-export types
export type { Conversation };

export class ConversationsRepository {
  /**
   * Get all conversations for a user
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    return conversationsDataSource.fetchConversations(userId);
  }

  /**
   * Subscribe to real-time conversation updates
   */
  subscribeToConversations(
    userId: string,
    callback: (conversations: Conversation[]) => void
  ): Unsubscribe {
    return conversationsDataSource.subscribeToConversations(userId, callback);
  }
}
