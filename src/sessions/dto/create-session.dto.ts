import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
