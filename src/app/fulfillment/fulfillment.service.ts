import { Injectable } from "@nestjs/common";
import Color from "color";
import { config } from "$config";
import { HyperionService } from "./Hyperion.service";

@Injectable()
export class FulfillmentService {
  private readonly hyperion = new HyperionService(config.hyperionUrl, config.hyperionOrigin);

  async getDevices() {
    return [config.device];
  }

  async getStatus(devices: { id: string }[]) {
    const [{ id }] = devices;
    if (id === config.device.id) {
      const online = this.hyperion.isReady;
      const currentSource = this.hyperion.getCurrentSource();
      const on = this.hyperion.isReady && this.hyperion.components.LEDDEVICE && currentSource?.visible;

      const status = online
        ? {
            on,
            brightness: this.hyperion.brightness,
            color: {
              spectrumRgb: Color(currentSource?.value?.RGB ?? [0, 0, 0], "rgb").rgbNumber(),
            },
          }
        : {};

      return {
        [id]: {
          online,
          status: online ? "SUCCESS" : "OFFLINE",
          ...status,
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
}
