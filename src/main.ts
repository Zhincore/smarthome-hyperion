import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { Bonjour } from "bonjour-service";
import { AppModule } from "./app/app.module";
import { config } from "./config";

async function bootstrap() {
  const bonjour = new Bonjour();
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  await app.listen(config.port, config.host);
  Logger.log(`Listening on ${await app.getUrl()}`);

  app.getHttpServer().on("close", () => bonjour.destroy());

  bonjour.publish({
    name: "Smart Home Hyperion",
    type: "smarthome-hyperion",
    port: config.port,
  });
}
bootstrap();
