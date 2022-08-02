import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";

const AuthHeaderRE = /^Bearer (?<token>.+)$/;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly service: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();

    const header = request.get("Authorization");
    if (!header) return false;

    const match = header.match(AuthHeaderRE);
    if (!match || !match.groups?.token) return false;

    const token = match.groups.token;
    try {
      const payload = await this.service.verifyAccessToken(token);
      request.agentId = payload.agentId;
    } catch {
      return false;
    }

    return true;
  }
}
