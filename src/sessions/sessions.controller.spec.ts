import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsRepository } from './sessions.repository';
import { EventsRepository } from './repositories/events.repository';
import { Session } from './schemas/session.schema';
import { Event } from './schemas/event.schema';

describe('SessionsController', () => {
  let controller: SessionsController;

  const mockSessionModel = {};
  const mockEventModel = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        SessionsService,
        SessionsRepository,
        EventsRepository,
        { provide: getModelToken(Session.name), useValue: mockSessionModel },
        { provide: getModelToken(Event.name), useValue: mockEventModel },
      ],
    }).compile();

    controller = module.get<SessionsController>(SessionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
