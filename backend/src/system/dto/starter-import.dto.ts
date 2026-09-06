import { ArrayMaxSize, IsArray, IsIn, IsObject } from "class-validator";

export class StarterImportDto {
  @IsIn(["employees", "suppliers", "vehicles", "assets", "works"])
  kind!: "employees" | "suppliers" | "vehicles" | "assets" | "works";

  @IsArray()
  @ArrayMaxSize(500)
  @IsObject({ each: true })
  rows!: Array<Record<string, unknown>>;
}
