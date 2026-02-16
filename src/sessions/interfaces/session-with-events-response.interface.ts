import { SessionDocument } from '../schemas/session.schema';
import { EventDocument } from '../schemas/event.schema';

export interface SessionWithEventsResponse {
  session: SessionDocument;
  events: EventDocument[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

