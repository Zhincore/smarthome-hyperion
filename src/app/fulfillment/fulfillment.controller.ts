import { Controller, Get, Post, Body, Request } from "@nestjs/common";
import Google from "actions-on-google";
import { Request as ExpressRequest } from "express";
import { Auth } from "$app/auth/auth.decorator";
import { FulfillmentService } from "./fulfillment.service";
import Color from "color";

@Controller("fulfillment")
@Auth()
export class FulfillmentController {
  constructor(private readonly service: FulfillmentService) {}

  @Get()
  hello() {
    return "hi";
  }

  @Post()
  async fulfillment(
    @Request() req: ExpressRequest,
    @Body("requestId") requestId: string,
    @Body("inputs") [input]: Google.SmartHomeV1Request["inputs"],
  ): Promise<Google.SmartHomeV1Response> {
    let payload = {};

    switch (input.intent) {
      case "action.devices.SYNC": {
        payload = {
          agentUserId: req.agentId!,
          devices: await this.service.getDevices(),
        } as Google.SmartHomeV1SyncPayload;
        break;
      }

      case "action.devices.QUERY": {
        const _input = input as Google.SmartHomeV1QueryRequestInputs;
        payload = {
          devices: await this.service.getStatus(_input.payload.devices),
        } as Google.SmartHomeV1QueryPayload;
        break;
      }

      case "action.devices.EXECUTE": {
        const _input = input as Google.SmartHomeV1ExecuteRequestInputs;
        const results: Promise<Google.SmartHomeV1ExecuteResponseCommands>[] = [];
        for (const command of _input.payload.commands) {
          results.push(this.executeCommand(command));
        }
        payload = {
          commands: await Promise.all(results),
        } as Google.SmartHomeV1ExecutePayload;
        break;
      }
    }

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
