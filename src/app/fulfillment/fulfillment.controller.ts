import { Controller, Get, Post, Body, Request } from "@nestjs/common";
import Google from "actions-on-google";
import { Request as ExpressRequest } from "express";
import { Auth } from "$app/auth/auth.decorator";
import { FulfillmentService } from "./fulfillment.service";

@Controller("fulfillment")
// @Auth()
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
    @Body("inputs") inputs: Google.SmartHomeV1Request["inputs"],
  ): Promise<Google.SmartHomeV1Response> {
    const response = { requestId };

    const processInput = async (input: Google.SmartHomeV1Request["inputs"][0]) => {
      switch (input.intent) {
        case "action.devices.SYNC":
          return {
            agentUserId: req.agentId!,
            devices: await this.service.getDevices(),
          } as Google.SmartHomeV1SyncResponse["payload"];

        case "action.devices.QUERY":
          const query = input as Google.SmartHomeV1QueryRequestInputs;
          return {
            devices: await this.service.getStatus(query.payload.devices),
          } as Google.SmartHomeV1QueryPayload;
      }
    };

    for (const input of inputs) {
      const result = await processInput(input);
      Object.assign(response, result);
    }

    return response;
  }
}
