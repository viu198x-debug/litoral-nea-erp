import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";

export class RequestApprovalDto {
  @IsString()
  @MaxLength(60)
  module: string;

  @IsString()
  @MaxLength(80)
  entityType: string;

  @IsString()
  @MaxLength(80)
  entityId: string;

  @IsString()
  @IsOptional()
  @Matches(/^c[a-z0-9]{20,32}$/)
  workId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  workflowCode?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;
}
