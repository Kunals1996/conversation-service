import { EventDocument } from '../schemas/event.schema';

export interface EventsPage {
  events: EventDocument[];
  total: number;
  limit: number;
  offset: number;
}
