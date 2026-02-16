import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session {
  @Prop({ required: true, unique: true })
  sessionId: string;

  @Prop({ required: true, enum: ['initiated', 'active', 'completed', 'failed'] })
  status: string;

  @Prop({ required: true })
  language: string;

  @Prop({ required: true })
  startedAt: Date;

  @Prop({ default: null })
  endedAt: Date;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.index({ status: 1 });
SessionSchema.index({ startedAt: -1 });

SessionSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    delete ret._id;
    return ret;
  },
});

