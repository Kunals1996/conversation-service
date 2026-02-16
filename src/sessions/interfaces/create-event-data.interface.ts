export interface CreateEventData {
  sessionId: string;
  eventId: string;
  type: 'user_speech' | 'bot_speech' | 'system';
  payload?: Record<string, unknown>;
  timestamp: Date;
}
