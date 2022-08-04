import { Injectable, OnModuleInit } from "@nestjs/common";
import Color from "color";
import { config } from "$config";
import { AuthService } from "$app/auth/auth.service";
import { HyperionService } from "./Hyperion.service";
import { ReportstateService } from "./reportstate.service";

@Injectable()
export class FulfillmentService implements OnModuleInit {
  private readonly reportstate = new ReportstateService();
  readonly hyperion = new HyperionService(config.hyperionUrl, config.hyperionOrigin);

  constructor(private readonly auth: AuthService) {
    this.hyperion.on("update", async (part) => {
      if (!["components", "priorities", "adjustment"].includes(part)) return;
      await this.reportStates();
    });
  }

  async onModuleInit() {
    this.hyperion.connect();
  }

  private async reportStates() {
    if (!this.hyperion.isReady) return;

    const devices = {
      states: {
        [config.device.id]: this.getStates(),
      },
    };

    for (const agentId of this.auth.getAgentsIds()) {
      this.reportstate.reportState(agentId, devices);
    }
  }

  async getDevices() {
    return [config.device];
  }

  getStates() {
    const currentSource = this.hyperion.getCurrentSource();
    const on = this.hyperion.isOn;

    return {
      on,
      brightness: this.hyperion.brightness,
      color: {
        spectrumRgb: Color(currentSource?.value?.RGB ?? [0, 0, 0], "rgb").rgbNumber(),
      },
      activeLightEffect: currentSource?.owner === "Rainbow swirl" ? "colorLoop" : undefined,
    };
  }

  async getStatus(devices: { id: string }[]) {
    const [{ id }] = devices;
    if (id === config.device.id) {
      const online = this.hyperion.isReady;
      const states = online ? this.getStates() : {};

      return {
        [id]: {
          online,
          status: online ? "SUCCESS" : "OFFLINE",
          ...states,
        },
      };
    } else {
      return {
        [id]: {
          online: false,
          status: "ERROR",
        },
      };
    }
  }

  async toggleLights(state?: boolean) {
    if (state === undefined) state = !this.hyperion.isOn;

    if (state) {
      if (!this.hyperion.components.ALL) {
        await this.hyperion.setComponentState("ALL", true);
      }
      if (!this.hyperion.components.LEDDEVICE) {
        await this.hyperion.setComponentState("LEDDEVICE", true);
      }
      if (!this.hyperion.brightness) {
        await this.hyperion.setBrightness(10);
      }
      if (!this.hyperion.getCurrentSource()) {
        await this.hyperion.setColor([128, 128, 128]);
      }
    } else if (this.hyperion.components.LEDDEVICE) {
      await this.hyperion.setComponentState("LEDDEVICE", false);
    }
  }
}
