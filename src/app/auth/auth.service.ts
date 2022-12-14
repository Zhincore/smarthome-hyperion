import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { Injectable, OnModuleInit } from "@nestjs/common";
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
export class AuthService implements OnModuleInit {
  private static readonly expiresMap: { [T in TokenType]: string } = {
    authorization: config.oAuth.authGrantExpires,
    access: config.oAuth.accessExpires,
    refresh: config.oAuth.refreshExpires,
  };

  private readonly agentIds = new Set<string>();

  getAgentsIds() {
    return this.agentIds.values();
  }

  removeAgentId(id: string) {
    return this.agentIds.delete(id);
  }

  async onModuleInit() {
    await this.loadAgentIds();
  }

  private async loadAgentIds() {
    try {
      const file = await fs.readFile(config.agentIdsPath, "utf-8");
      for (const id of JSON.parse(file)) {
        this.agentIds.add(id);
      }
    } catch (err) {
      if ("code" in err && err.code === "ENOENT") return;
      throw err;
    }
  }

  private async saveAgentIds() {
    await fs.writeFile(config.agentIdsPath, JSON.stringify(Array.from(this.agentIds)));
  }

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

  private async createNewAgentId() {
    const id = randomUUID();
    this.agentIds.add(id);
    await this.saveAgentIds();
    return id;
  }

  async generateAccessToken(agentId?: string) {
    if (!agentId) agentId = await this.createNewAgentId();
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
        resolve(payload as TokenTypes[TTokenType]);
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
    return this.verifyToken(token, "access", config.oAuth.clientId);
  }

  async verifyRefreshToken(token: string, clientId: string) {
    return this.verifyToken(token, "refresh", clientId);
  }
}
