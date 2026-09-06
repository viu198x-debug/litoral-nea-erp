import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: "Error interno del servidor" };
    const payload = typeof detail === "string" ? { message: detail } : detail;

    response.status(status).json({
      ...(payload as object),
      statusCode: status,
      path: request.path,
      requestId: response.getHeader("x-request-id"),
      timestamp: new Date().toISOString(),
    });
  }
}
