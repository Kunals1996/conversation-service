import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema';
import { CreateSessionData } from './interfaces/create-session-data.interface';

@Injectable()
export class SessionsRepository {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  /**
   * Idempotent create or return existing. Safe under concurrent requests:
   * uses findOneAndUpdate with upsert so that only one document is created.
   */
  async createOrReturn(data: CreateSessionData): Promise<SessionDocument> {
    const now = new Date();
    const result = await this.sessionModel.findOneAndUpdate(
      { sessionId: data.sessionId },
      {
        $setOnInsert: {
          sessionId: data.sessionId,
          status: 'initiated',
          language: data.language,
          startedAt: now,
          endedAt: null,
          metadata: data.metadata ?? {},
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return result as SessionDocument;
  }

  async findBySessionId(sessionId: string): Promise<SessionDocument | null> {
    return this.sessionModel.findOne({ sessionId }).exec();
  }

  async completeSession(sessionId: string): Promise<SessionDocument | null> {
    const now = new Date();
    return this.sessionModel
      .findOneAndUpdate(
        { sessionId, status: { $ne: 'completed' } },
        { $set: { status: 'completed', endedAt: now } },
        { returnDocument: 'after' },
      )
      .exec();
  }

  /**
   * Idempotent complete: return existing session if already completed.
   */
  async completeSessionIdempotent(
    sessionId: string,
  ): Promise<SessionDocument | null> {
    const existing = await this.findBySessionId(sessionId);
    if (!existing) return null;
    if (existing.status === 'completed') return existing;
    return this.completeSession(sessionId);
  }
}

