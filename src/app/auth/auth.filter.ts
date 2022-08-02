import { ExceptionFilter, Catch, ArgumentsHost, ForbiddenException } from "@nestjs/common";
import { Response } from "express";

@Catch(ForbiddenException)
export class AuthFilter implements ExceptionFilter {
  catch(_exception: ForbiddenException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(401).set("WWW-Authenticate", 'error="invalid_token"').json({
      status: 401,
      error: "Unauthorized",
    });
  }
}
