import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type Request, type Response } from 'express';

/** RFC 7807 payload (convention §14). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId?: string;
  [key: string]: unknown;
}

const TITLES: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  403: 'Acesso negado',
  404: 'Recurso não encontrado',
  409: 'Conflito',
  422: 'Não foi possível processar os dados enviados',
  429: 'Muitas requisições',
  500: 'Erro interno do servidor',
  503: 'Serviço indisponível',
};

/**
 * Turns every thrown error into `application/problem+json`.
 * Unknown errors never leak their message to the client — only to the log.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const problem: ProblemDetails = {
      type: 'about:blank',
      title: TITLES[status] ?? 'Erro',
      status,
      instance: request.url,
      requestId: request.id,
    };

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        problem.detail = body;
      } else if (body && typeof body === 'object') {
        const {
          message,
          error: _error,
          statusCode: _statusCode,
          ...rest
        } = body as Record<string, unknown> & { message?: unknown };
        Object.assign(problem, rest);
        if (Array.isArray(message)) problem.errors = message;
        else if (typeof message === 'string') problem.detail = message;
      }
    } else {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unhandled exception',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).type('application/problem+json').send(problem);
  }
}
