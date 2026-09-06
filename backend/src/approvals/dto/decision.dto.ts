import { ApprovalStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class DecisionDto {
  @IsEnum(ApprovalStatus)
  decision: ApprovalStatus;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  comments?: string;
}
