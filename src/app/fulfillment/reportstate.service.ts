import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { google, homegraph_v1 } from "googleapis";
import { config } from "$config";

const logger = new Logger("ReportstateService");

@Injectable()
export class ReportstateService {
  private client: homegraph_v1.Homegraph | undefined;

  constructor() {
    this.createClient();
  }

  private createClient() {
    if (!existsSync(config.googleAppCreds)) {
      logger.warn("Google Application Credentials not found. Report State disabled.");
      return;
    }

    this.client = google.homegraph({
      version: "v1",
      auth: new google.auth.GoogleAuth({
        keyFile: config.googleAppCreds,
        scopes: ["https://www.googleapis.com/auth/homegraph"],
      }),
    });
  }

  async reportState(agentUserId: string, devices: homegraph_v1.Schema$ReportStateAndNotificationDevice) {
    await this.client?.devices.reportStateAndNotification({
      requestBody: {
        agentUserId,
        requestId: randomUUID(),
        payload: { devices },
      },
    });
  }
}
