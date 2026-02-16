import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = isHttpException
      ? exception.getResponse()
      : {
          statusCode: status,
          message: 'Internal server error',
        };

    const errorMessage =
      typeof errorResponse === 'string'
        ? errorResponse
        : (errorResponse as Record<string, unknown>).message ??
          'Unexpected error';

    const stack =
      exception instanceof Error
        ? exception.stack
        : JSON.stringify(exception, null, 2);

    this.logger.error(
      `HTTP ${request.method} ${request.url} failed with status ${status}: ${errorMessage}`,
      stack,
    );

    response.status(status).json({
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(typeof errorResponse === 'string'
        ? { message: errorResponse }
        : errorResponse),
    });
  }
}

