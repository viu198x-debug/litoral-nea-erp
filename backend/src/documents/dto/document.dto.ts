import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class CreateDocumentDto {
  @IsString()
  @IsOptional()
  @Matches(/^c[a-z0-9]{20,32}$/)
  workId?: string;

  @IsString()
  @Matches(/^[a-z][a-z0-9-]{1,48}$/)
  module: string;

  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  entityType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  entityId?: string;
}

export class AddDocumentVersionDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  notes?: string;
}
