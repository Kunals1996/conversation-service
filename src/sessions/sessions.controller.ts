import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { AddEventDto } from './dto/add-event.dto';
import { GetSessionQueryDto } from './dto/get-session-query.dto';

@Controller('sessions')
export class SessionsController {
  private readonly logger = new Logger(SessionsController.name);

  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrUpsertSession(@Body() dto: CreateSessionDto) {
    this.logger.log(
      `POST /sessions sessionId=${dto.sessionId} language=${dto.language}`,
    );
    return this.sessionsService.createOrUpsertSession(dto);
  }

  @Post(':sessionId/events')
  @HttpCode(HttpStatus.CREATED)
  async addEvent(
    @Param('sessionId') sessionId: string,
    @Body() dto: AddEventDto,
  ) {
    this.logger.log(
      `POST /sessions/${sessionId}/events eventId=${dto.eventId} type=${dto.type}`,
    );
    return this.sessionsService.addEvent(sessionId, dto);
  }

  @Get(':sessionId')
  async getSessionWithEvents(
    @Param('sessionId') sessionId: string,
    @Query() query: GetSessionQueryDto,
  ) {
    this.logger.log(
      `GET /sessions/${sessionId}?limit=${query.limit ?? 20}&offset=${
        query.offset ?? 0
      }`,
    );
    return this.sessionsService.getSessionWithEvents(sessionId, query);
  }

  @Post(':sessionId/complete')
  async completeSession(@Param('sessionId') sessionId: string) {
    this.logger.log(`POST /sessions/${sessionId}/complete`);
    return this.sessionsService.completeSession(sessionId);
  }
}
