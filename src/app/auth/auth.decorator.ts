import { applyDecorators, UseGuards, UseFilters } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { AuthFilter } from "./auth.filter";

export function Auth() {
  return applyDecorators(UseGuards(AuthGuard), UseFilters(AuthFilter));
}
