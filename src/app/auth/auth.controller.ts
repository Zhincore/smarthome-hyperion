import { Controller, Redirect, Get, Post, Query, Body, BadRequestException } from "@nestjs/common";
import { config } from "$config";
import { AuthService, GrantType } from "./auth.service";
import { Auth } from "./auth.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly service: AuthService) {}

  // @Get()
  // @Header("content-type", "text/html")
  // async auth(@Query() query: Record<string, string>) {
  //   const url = new URL("/", "http://localhost");
  //   for (const key in query) {
  //     url.searchParams.append(key, query[key]);
  //   }

  //   return `<html><body><form method="POST" action="${url.search}"><input name="password" placeholder="password"><button>submit</button></from></body></html>`;
  // }

  @Get()
  @Redirect()
  async authPost(
    @Query("client_id") clientId: string,
    @Query("redirect_uri") redirectUri: string,
    @Query("state") state: string,
    // @Body("password") password: string,
  ) {
    // if (password !== config.oAuth.password) throw new UnauthorizedException("Invalid password");
    if (clientId !== config.oAuth.clientId) throw new BadRequestException("Unknown client_id");
    if (redirectUri !== config.oAuth.redirectUri) throw new BadRequestException("Invalid redirectUri");

    const url = new URL(redirectUri);
    url.searchParams.append("state", state);
    url.searchParams.append("code", await this.service.generateAuthToken(redirectUri));
    return { url: url.href };
  }

  @Post("token")
  async token(
    @Body("client_id") clientId: string,
    @Body("client_secret") secret: string,
    @Body("grant_type") grantType: GrantType,
    @Body("code") code?: string,
    @Body("redirect_uri") redirectUri?: string,
    @Body("refresh_token") refreshToken?: string,
  ) {
    if (clientId !== config.oAuth.clientId) throw new BadRequestException("Unknown client_id", "invalid_grant");
    if (secret !== config.oAuth.secret) throw new BadRequestException("Invalid secret", "invalid_grant");

    let agentId: string | undefined;

    if (grantType === "authorization_code") {
      try {
        await this.service.verifyAuthToken(code!, clientId, redirectUri!);
      } catch (err) {
        throw new BadRequestException(String(err), "invalid_grant");
      }
    } else if (grantType === "refresh_token") {
      try {
        const payload = await this.service.verifyRefreshToken(refreshToken!, clientId);
        agentId = payload.agentId;
      } catch (err) {
        throw new BadRequestException(String(err), "invalid_grant");
      }
    }

    return await this.service.generateAccessToken(agentId);
  }

  @Get("userinfo")
  @Auth()
  async userinfo() {
    return {
      sub: 0,
      email: "email@example.com",
    };
  }
}
