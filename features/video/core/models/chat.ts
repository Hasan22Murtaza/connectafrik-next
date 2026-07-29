export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  messageType: 'text' | 'system';
}

export interface Reaction {
  emoji: string;
  participantId: string;
  timestamp: number;
}
