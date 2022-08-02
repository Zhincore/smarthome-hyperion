import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { FulfillmentModule } from "./fulfillment/fulfillment.module";

@Module({
  imports: [AuthModule, FulfillmentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
