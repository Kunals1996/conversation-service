import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { Session, SessionSchema } from './schemas/session.schema';
import { Event, EventSchema } from './schemas/event.schema';
import { SessionsRepository } from './sessions.repository';
import { EventsRepository } from './repositories/events.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: Event.name, schema: EventSchema },
    ]),
  ],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsRepository, EventsRepository],
})
export class SessionsModule {}
