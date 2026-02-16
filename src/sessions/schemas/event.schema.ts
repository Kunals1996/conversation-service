import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EventDocument = Event & Document;

@Schema()
export class Event {
  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true, enum: ['user_speech', 'bot_speech', 'system'] })
  type: string;

  @Prop({ type: Object })
  payload: Record<string, unknown>;

  @Prop({ required: true })
  timestamp: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);

// Unique per session for idempotent add-event; compound for list by session + sort by timestamp
EventSchema.index({ sessionId: 1, eventId: 1 }, { unique: true });
EventSchema.index({ sessionId: 1, timestamp: 1 });

EventSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    delete ret._id;
    return ret;
  },
});
