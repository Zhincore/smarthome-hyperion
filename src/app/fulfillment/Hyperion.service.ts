import EventEmitter from "events";
import { Injectable, Logger } from "@nestjs/common";
import { WebSocket } from "ws";

const logger = new Logger("HyperionService");

@Injectable()
export class HyperionService {
  private responses = new EventEmitter();
  private ws: WebSocket;
  private tan = 0;
  serverinfo: Readonly<HyperionServerInfo>;
  components: ComponentsMap;

  constructor(url: string, public origin = "Hyperion.ts") {
    this.createConnection(url);
  }

  get isReady() {
    return this.ws.readyState === WebSocket.OPEN;
  }

  private getTan() {
    return (this.tan = (this.tan + 1) % Number.MAX_SAFE_INTEGER);
  }

  async waitUntilReady() {
    return new Promise<HyperionService>((resolve) => this.responses.once("_ready", () => resolve(this)));
  }

  get brightness() {
    return this.serverinfo.adjustment[0].brightness;
  }

  get isOn() {
    return (
      this.isReady &&
      this.components.ALL &&
      this.components.LEDDEVICE &&
      this.getCurrentSource()?.visible &&
      this.brightness
    );
  }

  private createConnection(url: string) {
    this.ws = new WebSocket(url, {});
    this.ws.once("close", (code, reason) => {
      logger.warn("Lost connection with Hyperion:", reason.toString());

      // Reconnect
      if (code !== 1000) setTimeout(() => this.createConnection(this.ws.url), 5000);
    });
    this.ws.on("error", console.error);
    this.ws.on("message", (data) => {
      const message: HMessage = JSON.parse(data.toString());

      // It's a response
      if ("tan" in message && message.command) this.responses.emit(message.command + ":" + message.tan, message);
      // It's an event
      else if (message.command.endsWith("-update")) {
        this.updateServerinfo(message);
        this.responses.emit(message.command, message.data);
      }
      // It's unhandled
      else console.error("Unhandled message", message);
    });

    // Init
    this.ws.once("open", async () => {
      logger.log("Connected to Hyperion.");
      this.serverinfo = await this.send("serverinfo", { subscribe: ["all"] });
      this.updateComponents(...this.serverinfo.components);
      this.responses.emit("_ready");
    });

    return this.ws;
  }

  private updateComponents(...components: Component[]) {
    if (!this.components) this.components = {} as any;
    for (const comp of components) {
      this.components[comp.name] = comp.enabled;
    }
  }

  private updateServerinfo(message: HMessage) {
    const part = message.command.slice(0, -"-update".length); // as keyof HyperionServerInfo
    switch (part) {
      // Single data
      case "sessions":
      case "adjustment":
      case "instance":
        (this.serverinfo as any)[part] = message.data;
        break;

      // Patch
      case "priorities":
      case "imageToLedMapping":
      case "videomode":
      case "effects":
      case "leds":
        Object.assign(this.serverinfo, message.data);
        break;

      // Components
      case "components":
        this.updateComponents(message.data);
        break;
    }
  }

  async awaitUpdate(type: string) {
    return new Promise((resolve) => {
      this.responses.once(type + "-update", resolve);
    });
  }

  async send<Response = void>(command: string, data: any = {}) {
    const tan = this.getTan();
    return new Promise<Response>((resolve, reject) => {
      this.ws.send(JSON.stringify({ ...data, command, tan }), (err) => err && reject(err));
      this.responses.once(command + ":" + tan, (response: HMessage) => {
        if (response.success) return resolve(response.info as Response);
        return reject(response.error);
      });
    });
  }

  /**
   * Set a color for all leds or provide a pattern of led colors.
   * @param color An array of R G B Integer values e.g. `[R,G,B]`
   * @param duration Duration of color in ms. If you don't provide a duration, it's 0 -> indefinite
   * @param priority We recommend `50`, following the {@link https://docs.hyperion-project.org/en/api/guidelines#priority_guidelines Priority Guidelines}. Min `2` Max `99`
   */
  async setColor(color: [number, number, number] | number[], duration?: number, priority = 1) {
    return this.send("color", { color, duration, priority, origin: this.origin });
  }

  async setEffect(name: string, effectArgs: Record<string, any> = {}, duration = 0, priority = 1) {
    return this.send("effect", { effect: { name, ...effectArgs }, duration, priority, origin: this.origin });
  }

  async clear(priority = 1) {
    return this.send("clear", { priority });
  }

  async setBrightness(brightness: number) {
    return this.send("adjustment", { adjustment: { brightness } });
  }

  async setComponentState(component: ComponentId, state?: boolean) {
    if (state === undefined) state = !this.components[component];
    return this.send("componentstate", { componentstate: { component, state } });
  }

  /** Helper function to get the current selected source */
  getCurrentSource() {
    return this.serverinfo.priorities[0];
  }
}

interface HMessage {
  /** The command you requested. */
  command: string;
  /** The data you requested (if any). */
  info: any;
  /** New data from update event */
  data: any;
  /** If false, an error argument will contain details of the issue. */
  success: boolean;
  /** The tan you provided (If not, it will default to 0 in the response). */
  tan: number;
  error?: string;
}

/** Each component has a unique id. Not all of them can be enabled/disabled -- some of them, such as effect and color, are used to determine the source type when examining the {@link https://docs.hyperion-project.org/en/json/ServerInfo.html#priorities priority list}.
 * @see https://docs.hyperion-project.org/en/json/control.html#components-ids-explained
 */
type ComponentId =
  | "SMOOTHING"
  | "BLACKBORDER"
  | "FORWARDER"
  | "BOBLIGHTSERVER"
  | "GRABBER"
  | "V4L"
  | "LEDDEVICE"
  | "ALL"
  | "COLOR"
  | "EFFECT"
  | "IMAGE"
  | "FLATBUFSERVER"
  | "PROTOSERVER";

type ComponentsMap = { [Component in ComponentId]: boolean };
type Component = { name: ComponentId; enabled: boolean };

interface Source {
  /** If "true" it is selectable for manual source selection. {@link https://docs.hyperion-project.org/en/json/control#source-selection See also source selection} */
  active: boolean;
  /** If "true" this source is displayed and pushed to the led device. The `visible:true`-source is always the first entry! */
  visible: boolean;
  /**  A key belonging to a specific component that indicates the kind of input. */
  componentId: ComponentId;
  /** A named external setter of this source for reference purposes. If not given it's System (from Hyperion). */
  origin: string;
  /** Contains additional information related to the componentId. If it's an effect, the effect name is shown here. If it's USB capture, the capture device is shown. If it's platform capture, you get the name of the platform capture implementation (e.g. dispmanx/x11/amlogic/...). */
  owner: string;
  /** The priority of this source, an integer between 0 and 255. */
  priority: number;
  /** If the source is a color AND color data is available (if active is false there's usually no datta), hen this will be the color in RGB and HSL. */
  value?: ColorValue;
  /** Actual duration in ms until this priority is automatically deleted. This is shown if source is color or effect AND a specific duration higher than `0` is set (0 means indefinite). */
  duration_ms?: number;
}

/** Adjustments reflect the value of the last performed (non-persistent) color adjustment (e.g. brightness). */
interface Adjustment {
  backlightColored: boolean;
  backlightThreshold: number;
  blue: [number, number, number];
  brightness: number;
  cyan: [number, number, number];
  gammaBlue: number;
  gammaGreen: number;
  gammaRed: number;
  green: [number, number, number];
  id: string;
  magenta: [number, number, number];
  red: [number, number, number];
  white: [number, number, number];
  yellow: [number, number, number];
}

interface ColorValue {
  HSL: [number, number, number];
  RGB: [number, number, number];
}

// TODO
interface HyperionServerInfo {
  /** Overview of the registered/active sources. Each object is a source. */
  priorities: Source[];
  /** List of Hyperion components and their current status "enabled" (on/off). You can enable or disable them during runtime . The "ALL" component reflect Hyperion as a whole -- if "ALL" is false (off) you can't enable any other component. */
  components: Component[];
  /** Adjustments reflect the value of the last performed (non-persistent) color adjustment (e.g. brightness). */
  adjustment: Adjustment[];
}
