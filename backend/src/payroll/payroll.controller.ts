import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { EntityIdPipe } from "../common/validation.pipes";
import {
  CreatePayrollExtraDto,
  PayPayrollBatchDto,
  UpdateEmployeePaymentScheduleDto,
} from "./payroll.dto";
import { PayrollService } from "./payroll.service";

@Controller("payroll")
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get("employees")
  @RequirePermission("payroll", "view")
  employees() {
    return this.payroll.employeesWithPaymentSchedule();
  }

  @Patch("employees/:id/payment-schedule")
  @RequirePermission("payroll", "modify")
  updatePaymentSchedule(
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: UpdateEmployeePaymentScheduleDto,
  ) {
    return this.payroll.updatePaymentSchedule(id, dto);
  }

  @Post("extras")
  @RequirePermission("payroll", "create")
  createExtra(@CurrentUser() user: AuthUser, @Body() dto: CreatePayrollExtraDto) {
    return this.payroll.createExtra(user.id, dto);
  }

  @Get("extras")
  @RequirePermission("payroll", "view")
  extras(@Query("period") period?: string, @Query("employeeId") employeeId?: string) {
    return this.payroll.extras(period, employeeId);
  }

  @Get("calendar")
  @RequirePermission("payroll", "view")
  calendar(@Query("from") from?: string, @Query("to") to?: string) {
    return this.payroll.calendar(from, to);
  }

  @Get("totals")
  @RequirePermission("payroll", "view")
  totals(@Query("period") period?: string) {
    return this.payroll.totals(period);
  }

  @Post("batches/pay")
  @RequirePermission("payroll", "approve")
  payBatch(@CurrentUser() user: AuthUser, @Body() dto: PayPayrollBatchDto) {
    return this.payroll.payBatch(user.companyId, user.id, dto);
  }

  @Post("alerts/refresh")
  @RequirePermission("payroll", "modify")
  refreshAlerts(@Query("days") days?: string) {
    return this.payroll.refreshAlerts(Number(days ?? 10));
  }
}
