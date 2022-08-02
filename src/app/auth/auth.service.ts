import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import ms from "ms";
import { config } from "$config";

type TokenTypes = {
  authorization: AuthToken;
  access: AcesssToken;
  refresh: AcesssToken;
};
export type TokenType = keyof TokenTypes;
export type GrantType = "authorization_code" | "refresh_token";

interface Token {
  type: TokenType;
  clientId: string;
}

interface AuthToken extends Token {
  redirectUri: string;
}

interface AcesssToken extends Token {
  agentId: string;
}

@Injectable()
export class AuthService {
  private static readonly expiresMap: { [T in TokenType]: string } = {
    authorization: config.oAuth.authGrantExpires,
    access: config.oAuth.accessExpires,
    refresh: config.oAuth.refreshExpires,
  };

  private async generateToken<TTokenType extends TokenType>(
    type: TTokenType,
    payload: Omit<TokenTypes[TTokenType], keyof Token>,
  ) {
    return new Promise<string>((resolve, reject) =>
      jwt.sign(
        {
          type,
          clientId: config.oAuth.clientId,
          ...payload,
        },
        config.oAuth.secret,
        {
          expiresIn: AuthService.expiresMap[type],
        },
        (err, token) => (err ? reject(err) : resolve(token as any)),
      ),
    );
  }

  async generateAuthToken(redirectUri: string) {
    return this.generateToken("authorization", { redirectUri });
  }

  async generateAccessToken(agentId?: string) {
    if (!agentId) agentId = await randomUUID();
    const access_token = await this.generateToken("access", { agentId });
    const refresh_token = await this.generateToken("refresh", { agentId });

    return {
      token_type: "Bearer",
      access_token,
      refresh_token,
      expires_in: Math.round(ms(AuthService.expiresMap.access) / 1000),
    };
  }

  private async verifyToken<TTokenType extends TokenType>(token: string, type: TTokenType, clientId: string) {
    return new Promise<TokenTypes[TTokenType]>((resolve, reject) =>
      jwt.verify(token, config.oAuth.secret, (err, payload: Token) => {
        if (err) return reject(err);
        if (payload.type !== type) {
          return reject(new Error("Token is of unexpected type"));
        }
        if (payload.clientId !== clientId) {
          return reject(new Error("Token issued for different client_id"));
        }
        return payload;
      }),
    );
  }

  async verifyAuthToken(token: string, clientId: string, redirectUri: string) {
    const payload = await this.verifyToken(token, "authorization", clientId);
    if (payload.redirectUri !== redirectUri) {
      throw new Error("Token issued for different redirectUri");
    }
    return payload;
  }

  async verifyAccessToken(token: string) {
    return this.verifyToken(token, "refresh", config.oAuth.clientId);
  }

  async verifyRefreshToken(token: string, clientId: string) {
    return this.verifyToken(token, "refresh", clientId);
  }
}
