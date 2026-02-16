import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppModule } from './app.module';
import { Connection } from 'mongoose';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const connection = app.get<Connection>(getConnectionToken());
  if (connection.readyState === 1) {
    logger.log('MongoDB connected');
  } else {
    connection.once('connected', () => logger.log('MongoDB connected'));
  }

  logger.log(`Conversation service started and listening on http://localhost:${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
}
bootstrap();
