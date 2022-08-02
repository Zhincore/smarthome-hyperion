import { Module } from "@nestjs/common";
import { AuthModule } from "$app/auth/auth.module";
import { FulfillmentController } from "./fulfillment.controller";
import { FulfillmentService } from "./fulfillment.service";

@Module({
  imports: [AuthModule],
  controllers: [FulfillmentController],
  providers: [FulfillmentService],
})
export class FulfillmentModule {}
