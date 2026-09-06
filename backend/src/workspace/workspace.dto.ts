import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class CreateTechnicalTaskDto {
  @IsOptional()
  @IsString()
  workId?: string;

  @IsString()
  @Length(2, 80)
  discipline!: string;

  @IsString()
  @Length(2, 80)
  taskType!: string;

  @IsString()
  @Length(3, 180)
  title!: string;

  @IsString()
  @Length(3, 5000)
  description!: string;

  @IsOptional()
  @IsIn(["LOW", "NORMAL", "HIGH", "CRITICAL"])
  priority?: string;

  @IsString()
  assignedUserId!: string;

  @IsOptional()
  @IsString()
  reviewerUserId?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPct?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTechnicalTaskDto {
  @IsOptional()
  @IsIn(["DRAFT", "PENDING", "APPROVED", "REJECTED", "ACTIVE", "CLOSED", "VOID"])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPct?: number;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
