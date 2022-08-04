import { Module } from "@nestjs/common";
import { AuthModule } from "$app/auth/auth.module";
import { FulfillmentController } from "./fulfillment.controller";
import { FulfillmentService } from "./fulfillment.service";
import { ReportstateService } from "./reportstate.service";

@Module({
  imports: [AuthModule],
  controllers: [FulfillmentController],
  providers: [FulfillmentService, ReportstateService],
})
export class FulfillmentModule {}
