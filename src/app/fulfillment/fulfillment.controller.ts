import { Controller, Get, Post, Body, Request } from "@nestjs/common";
import Google from "actions-on-google";
import { Request as ExpressRequest } from "express";
import Color from "color";
import { Auth } from "$app/auth/auth.decorator";
import { AuthService } from "$app/auth/auth.service";
import { FulfillmentService } from "./fulfillment.service";

@Controller("fulfillment")
@Auth()
export class FulfillmentController {
  constructor(private readonly service: FulfillmentService, private readonly auth: AuthService) {}

  @Get()
  hello() {
    return "hi";
  }

  private readonly intents: Record<
    Google.SmartHomeV1Intents,
    (input: Google.SmartHomeV1Request["inputs"][0], req: ExpressRequest) => Promise<Google.SmartHomeV1Response>
  > = {
    "action.devices.SYNC": async (_, req): Promise<Google.SmartHomeV1SyncPayload> => ({
      agentUserId: req.agentId!,
      devices: await this.service.getDevices(),
    }),

    "action.devices.QUERY": async (
      input: Google.SmartHomeV1QueryRequestInputs,
    ): Promise<Google.SmartHomeV1QueryPayload> => ({
      devices: await this.service.getStatus(input.payload.devices),
    }),

    "action.devices.EXECUTE": async (
      input: Google.SmartHomeV1ExecuteRequestInputs,
    ): Promise<Google.SmartHomeV1ExecutePayload> => ({
      commands: await Promise.all(input.payload.commands.map((command) => this.executeCommand(command))),
    }),

    "action.devices.DISCONNECT": async (_, req) => {
      this.auth.removeAgentId(req.agentId!);
      return {};
    },
  };

  @Post()
  async fulfillment(
    @Request() req: ExpressRequest,
    @Body("requestId") requestId: string,
    @Body("inputs") [rawinput]: Google.SmartHomeV1Request["inputs"],
  ): Promise<Google.SmartHomeV1Response> {
    const payload = await this.intents[rawinput.intent](rawinput, req);

    return { requestId, payload };
  }

  async executeCommand(
    command: Google.SmartHomeV1ExecuteRequestCommands,
  ): Promise<Google.SmartHomeV1ExecuteResponseCommands> {
    if (!this.service.hyperion.isReady) {
      return {
        ids: command.devices.map((d) => d.id),
        status: "OFFLINE",
      };
    }

    for (const item of command.execution) {
      switch (item.command) {
        case "action.devices.commands.OnOff": {
          await this.service.toggleLights(item.params!.on);
          break;
        }
        case "action.devices.commands.BrightnessAbsolute": {
          await this.service.toggleLights(true);
          await this.service.hyperion.setBrightness(item.params!.brightness);
          break;
        }
        case "action.devices.commands.ColorAbsolute": {
          await this.service.toggleLights(true);
          await this.service.hyperion.setColor(Color(item.params!.color.spectrumRGB).rgb().array());
          break;
        }
        case "action.devices.commands.ColorLoop": {
          await this.service.toggleLights(true);
          await this.service.hyperion.setEffect("Rainbow swirl", {}, (item.params?.duration ?? 0) * 1000);
          break;
        }
        case "action.devices.commands.StopEffect": {
          await this.service.hyperion.clear();
          break;
        }
      }
    }

    return {
      ids: command.devices.map((d) => d.id),
      status: "SUCCESS",
      states: { ...this.service.getStates(), online: true },
    };
  }
}
