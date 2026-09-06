import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { mkdirSync } from "node:fs";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { diskStorage } from "multer";
import { CurrentUser, type AuthUser } from "../common/current-user.decorator";
import { RequirePermission } from "../common/permissions.decorator";
import { DocumentsService } from "./documents.service";
import { EntityIdPipe } from "../common/validation.pipes";
import {
  AddDocumentVersionDto,
  CreateDocumentDto,
} from "./dto/document.dto";

const allowedExtensions = new Set([
  ".pdf",
  ".xlsx",
  ".xls",
  ".docx",
  ".dwg",
  ".dxf",
  ".jpg",
  ".jpeg",
  ".png",
  ".zip",
]);

const storage = diskStorage({
  destination: (_request, _file, callback) => {
    const path = process.env.DOCUMENT_STORAGE_PATH ?? "./storage/documents";
    mkdirSync(path, { recursive: true, mode: 0o750 });
    callback(null, path);
  },
  filename: (_request, file, callback) => {
    callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
  },
});

const upload = FileInterceptor("file", {
  storage,
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024,
    files: 1,
    fields: 8,
    parts: 9,
    fieldNameSize: 80,
    fieldSize: 16 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    const allowed = allowedExtensions.has(extname(file.originalname).toLowerCase());
    callback(
      allowed ? null : new BadRequestException("Tipo de archivo no permitido"),
      allowed,
    );
  },
});

@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @RequirePermission("documents", "view")
  list(
    @CurrentUser() user: AuthUser,
    @Query("workId") workId?: string,
    @Query("module") module?: string,
  ) {
    return this.documents.list(user.companyId, { workId, module });
  }

  @Post()
  @RequirePermission("documents", "create")
  @UseInterceptors(upload)
  create(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateDocumentDto,
  ) {
    if (!file) throw new BadRequestException("Debe adjuntar un archivo");
    if (!body.module || !body.title) {
      throw new BadRequestException("Módulo y título son obligatorios");
    }
    return this.documents.create(file, body, user.id, user.companyId);
  }

  @Post(":id/versions")
  @RequirePermission("documents", "modify")
  @UseInterceptors(upload)
  addVersion(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body?: AddDocumentVersionDto,
  ) {
    if (!file) throw new BadRequestException("Debe adjuntar un archivo");
    return this.documents.addVersion(id, file, user.id, user.companyId, body?.notes);
  }

  @Get(":id/download")
  @RequirePermission("documents", "download")
  async download(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
    @Query("version", new ParseIntPipe({ optional: true })) version: number | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.documents.getVersion(id, user.companyId, version);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    );
    response.setHeader("Content-Type", file.mimeType);
    response.setHeader("X-Content-SHA256", file.sha256);
    return new StreamableFile(file.stream);
  }

  @Delete(":id")
  @RequirePermission("documents", "void")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("id", EntityIdPipe) id: string,
  ) {
    return this.documents.softDelete(id, user.companyId);
  }
}
