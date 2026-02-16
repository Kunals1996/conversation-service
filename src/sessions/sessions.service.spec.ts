import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { SessionsService } from './sessions.service';
import { SessionsRepository } from './sessions.repository';
import { EventsRepository } from './repositories/events.repository';
import { Session } from './schemas/session.schema';
import { Event } from './schemas/event.schema';

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionsRepository: SessionsRepository;
  let eventsRepository: EventsRepository;

  const mockSessionModel = {};
  const mockEventModel = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        SessionsRepository,
        EventsRepository,
        { provide: getModelToken(Session.name), useValue: mockSessionModel },
        { provide: getModelToken(Event.name), useValue: mockEventModel },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    sessionsRepository = module.get<SessionsRepository>(SessionsRepository);
    eventsRepository = module.get<EventsRepository>(EventsRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
