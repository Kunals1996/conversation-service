import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from '../schemas/event.schema';
import { CreateEventData } from '../interfaces/create-event-data.interface';
import { EventsPage } from '../interfaces/events-page.interface';

@Injectable()
export class EventsRepository {
  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: Model<EventDocument>,
  ) {}

  /**
   * Insert event. Duplicate (sessionId + eventId) will throw; caller treats as idempotent success.
   */
  async insertOne(data: CreateEventData): Promise<EventDocument> {
    const doc = new this.eventModel(data);
    return doc.save();
  }

  /**
   * Returns event if it already exists (for idempotent add: return existing instead of duplicate).
   */
  async findBySessionIdAndEventId(
    sessionId: string,
    eventId: string,
  ): Promise<EventDocument | null> {
    return this.eventModel.findOne({ sessionId, eventId }).exec();
  }

  async findBySessionIdPaginated(
    sessionId: string,
    limit: number,
    offset: number,
  ): Promise<EventsPage> {
    const [events, total] = await Promise.all([
      this.eventModel
        .find({ sessionId })
        .sort({ timestamp: 1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.eventModel.countDocuments({ sessionId }).exec(),
    ]);
    return {
      events,
      total,
      limit,
      offset,
    };
  }
}

