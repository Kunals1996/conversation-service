import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export enum EventType {
  UserSpeech = 'user_speech',
  BotSpeech = 'bot_speech',
  System = 'system',
}

export class AddEventDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsEnum(EventType, {
    message: `type must be one of the following values: ${Object.values(EventType).join(', ')}`,
  })
  type: EventType;

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;

  @IsDateString()
  timestamp: string;
}
