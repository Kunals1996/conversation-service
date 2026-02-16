import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SessionDocument } from './schemas/session.schema';
import { EventDocument } from './schemas/event.schema';
import { SessionsRepository } from './repositories/sessions.repository';
import { EventsRepository } from './repositories/events.repository';
import { CreateSessionDto } from './dto/create-session.dto';
import { AddEventDto } from './dto/add-event.dto';
import { GetSessionQueryDto } from './dto/get-session-query.dto';
import { SessionWithEventsResponse } from './interfaces/session-with-events-response.interface';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly eventsRepository: EventsRepository,
  ) {}

  async createOrUpsertSession(dto: CreateSessionDto): Promise<SessionDocument> {
    const session = await this.sessionsRepository.createOrReturn({
      sessionId: dto.sessionId,
      language: dto.language,
      metadata: dto.metadata,
    });
    this.logger.log(`Session createOrUpsert: ${dto.sessionId} language=${dto.language} status=${session.status}`);
    return session;
  }

  async addEvent(
    sessionId: string,
    dto: AddEventDto,
  ): Promise<EventDocument> {
    const session = await this.sessionsRepository.findBySessionId(sessionId);
    if (!session) {
      this.logger.warn(`Add event failed: session not found ${sessionId}`);
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    const existing = await this.eventsRepository.findBySessionIdAndEventId(
      sessionId,
      dto.eventId,
    );
    if (existing) {
      this.logger.log(`Event returned (idempotent): sessionId=${sessionId} eventId=${dto.eventId}`);
      return existing;
    }

    const timestamp = new Date(dto.timestamp);
    if (isNaN(timestamp.getTime())) {
      throw new BadRequestException('Invalid timestamp');
    }

    try {
      const event = await this.eventsRepository.insertOne({
        sessionId,
        eventId: dto.eventId,
        type: dto.type,
        payload: dto.payload,
        timestamp,
      });
      this.logger.log(`Event added: sessionId=${sessionId} eventId=${dto.eventId} type=${dto.type}`);
      return event;
    } catch (err: unknown) {
      const isDuplicate =
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code?: number }).code === 11000;
      if (isDuplicate) {
        this.logger.log(`Event returned (duplicate key): sessionId=${sessionId} eventId=${dto.eventId}`);
        const existingEvent =
          await this.eventsRepository.findBySessionIdAndEventId(
            sessionId,
            dto.eventId,
          );
        if (existingEvent) return existingEvent;
      }
      throw err;
    }
  }

  async getSessionWithEvents(
    sessionId: string,
    query: GetSessionQueryDto,
  ): Promise<SessionWithEventsResponse> {
    const session = await this.sessionsRepository.findBySessionId(sessionId);
    if (!session) {
      this.logger.warn(`Get session failed: session not found ${sessionId}`);
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const page = await this.eventsRepository.findBySessionIdPaginated(
      sessionId,
      limit,
      offset,
    );

    this.logger.log(
      `Session retrieved: ${sessionId} events=${page.events.length}/${page.total} (limit=${limit} offset=${offset})`,
    );

    return {
      session,
      events: page.events,
      pagination: {
        total: page.total,
        limit: page.limit,
        offset: page.offset,
      },
    };
  }

  async completeSession(sessionId: string): Promise<SessionDocument> {
    const session =
      await this.sessionsRepository.completeSessionIdempotent(sessionId);
    if (!session) {
      this.logger.warn(
        `Complete session failed: session not found ${sessionId}`,
      );
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }
    this.logger.log(`Session completed: ${sessionId}`);
    return session;
  }
}
