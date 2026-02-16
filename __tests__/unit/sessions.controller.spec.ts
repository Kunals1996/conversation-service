import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SessionsController } from '../../src/sessions/sessions.controller';
import { SessionsService } from '../../src/sessions/sessions.service';
import { SessionsRepository } from '../../src/sessions/sessions.repository';
import { EventsRepository } from '../../src/sessions/repositories/events.repository';
import { Session } from '../../src/sessions/schemas/session.schema';
import { Event } from '../../src/sessions/schemas/event.schema';

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
