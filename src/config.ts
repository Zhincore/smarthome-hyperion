import { config as dotenv } from "dotenv";
import type { SmartHomeV1SyncDevices } from "actions-on-google";

dotenv();

const deviceId = env("DEVICE_ID");
const device: SmartHomeV1SyncDevices = {
  id: deviceId,
  type: "action.devices.types.LIGHT",
  traits: [
    "action.devices.traits.OnOff",
    "action.devices.traits.ColorSetting",
    "action.devices.traits.Brightness",
    "action.devices.traits.LightEffects",
  ],
  name: { defaultNames: ["Hyperion", deviceId], name: "Leds", nicknames: [] },
  willReportState: false,
  attributes: {
    colorModel: "rgb",
    supportedEffects: ["colorLoop"],
  },
  otherDeviceIds: [{ deviceId: "local-hyperion-id" }],
};

export const config = {
  oAuth: {
    clientId: env("GOOGLE_CLIENT_ID"),
    secret: env("GOOGLE_SECRET"),
    redirectUri: env("GOOGLE_REDIRECT_URI"),
    password: env("ACCESS_PASSWORD"),
    authGrantExpires: env("AUTH_GRANT_EXPIRES", "10m"),
    accessExpires: env("ACCESS_EXPIRES", "1h"),
    refreshExpires: env("REFRESH_EXPIRES", "1y"),
  },
  host: env("HOST", "localhost"),
  port: parseInt(env("PORT", "3000")),
  hyperionUrl: env("HYPERION_WS_URL"),
  hyperionOrigin: env("HYPERION_ORIGIN", "Smart Home"),
  device,
};

function env(key: string, fallback?: string): string {
  if (fallback === undefined && !(key in process.env)) throw new Error(`Missing env variable '${key}'!`);
  return (process.env[key] ?? fallback) as string;
}
