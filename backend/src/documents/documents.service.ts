import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import { basename, extname, resolve, sep } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { ERP_MODULES } from "../common/validation.pipes";

interface DocumentMeta {
  workId?: string;
  module: string;
  title: string;
  description?: string;
  entityType?: string;
  entityId?: string;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".dwg": "image/vnd.dwg",
  ".dxf": "image/vnd.dxf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".zip": "application/zip",
};

@Injectable()
export class DocumentsService {
  private readonly storageRoot: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.storageRoot = resolve(
      config.get<string>("DOCUMENT_STORAGE_PATH", "./storage/documents"),
    );
  }

  async list(
    companyId: string,
    filters: { workId?: string; module?: string },
  ) {
    if (filters.module && !ERP_MODULES.has(filters.module)) {
      throw new BadRequestException("Módulo no válido");
    }
    if (filters.workId) await this.requireWork(companyId, filters.workId);
    const documents = await this.prisma.document.findMany({
      where: {
        workId: filters.workId,
        module: filters.module,
        deletedAt: null,
        OR: [{ workId: null }, { work: { companyId } }],
      },
      include: {
        work: { select: { code: true, name: true } },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            version: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            sha256: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return documents.map((document) => ({
      ...document,
      versions: document.versions.map((version) => ({
        ...version,
        sizeBytes: version.sizeBytes.toString(),
      })),
    }));
  }

  async create(
    file: Express.Multer.File,
    meta: DocumentMeta,
    userId: string,
    companyId: string,
  ) {
    try {
      if (meta.workId) await this.requireWork(companyId, meta.workId);
      const mimeType = await this.validateFile(file);
      const sha256 = await this.hash(file.path);
      const document = await this.prisma.document.create({
        data: {
          ...meta,
          title: meta.title.trim(),
          createdById: userId,
          versions: {
            create: {
              version: 1,
              originalName: this.safeOriginalName(file.originalname),
              storageKey: resolve(file.path),
              mimeType,
              sizeBytes: BigInt(file.size),
              sha256,
              uploadedById: userId,
            },
          },
        },
        include: { versions: true },
      });
      return {
        ...document,
        versions: document.versions.map((version) => ({
          ...version,
          sizeBytes: version.sizeBytes.toString(),
        })),
      };
    } catch (error) {
      await fs.unlink(file.path).catch(() => undefined);
      throw error;
    }
  }

  async addVersion(
    documentId: string,
    file: Express.Multer.File,
    userId: string,
    companyId: string,
    notes?: string,
  ) {
    try {
      const document = await this.requireDocument(companyId, documentId);
      const mimeType = await this.validateFile(file);
      const version = document.currentVersion + 1;
      const sha256 = await this.hash(file.path);
      return await this.prisma.$transaction(async (tx) => {
        await tx.document.update({
          where: { id: documentId },
          data: { currentVersion: version, status: DocumentStatus.DRAFT },
        });
        const created = await tx.documentVersion.create({
          data: {
            documentId,
            version,
            originalName: this.safeOriginalName(file.originalname),
            storageKey: resolve(file.path),
            mimeType,
            sizeBytes: BigInt(file.size),
            sha256,
            uploadedById: userId,
            notes,
          },
        });
        return { ...created, sizeBytes: created.sizeBytes.toString() };
      });
    } catch (error) {
      await fs.unlink(file.path).catch(() => undefined);
      throw error;
    }
  }

  async getVersion(documentId: string, companyId: string, version?: number) {
    await this.requireDocument(companyId, documentId);
    const result = await this.prisma.documentVersion.findFirst({
      where: { documentId, version },
      orderBy: { version: "desc" },
      include: { document: true },
    });
    if (!result || result.document.deletedAt) {
      throw new NotFoundException("Archivo no encontrado");
    }
    const storagePath = this.safeStoragePath(result.storageKey);
    const stat = await fs.stat(storagePath).catch(() => null);
    if (!stat?.isFile()) throw new NotFoundException("Archivo no encontrado");
    return {
      ...result,
      stream: createReadStream(storagePath),
    };
  }

  async softDelete(id: string, companyId: string) {
    await this.requireDocument(companyId, id);
    return this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date(), status: DocumentStatus.OBSOLETE },
    });
  }

  private async validateFile(file: Express.Multer.File) {
    const extension = extname(file.originalname).toLowerCase();
    const expectedMime = MIME_BY_EXTENSION[extension];
    if (!expectedMime) throw new BadRequestException("Tipo de archivo no permitido");
    const handle = await fs.open(file.path, "r");
    try {
      const header = Buffer.alloc(8192);
      const { bytesRead } = await handle.read(header, 0, header.length, 0);
      const data = header.subarray(0, bytesRead);
      const valid = this.matchesSignature(extension, data);
      if (!valid) {
        throw new BadRequestException(
          "El contenido del archivo no coincide con su extensión",
        );
      }
    } finally {
      await handle.close();
    }
    return expectedMime;
  }

  private matchesSignature(extension: string, data: Buffer) {
    const starts = (...bytes: number[]) =>
      bytes.every((value, index) => data[index] === value);
    if (extension === ".pdf") return data.subarray(0, 5).toString() === "%PDF-";
    if ([".xlsx", ".docx", ".zip"].includes(extension)) {
      return starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06);
    }
    if (extension === ".xls") {
      return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    }
    if (extension === ".jpg" || extension === ".jpeg") {
      return starts(0xff, 0xd8, 0xff);
    }
    if (extension === ".png") {
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    }
    if (extension === ".dwg") return /^AC10\d{2}/.test(data.subarray(0, 6).toString("ascii"));
    if (extension === ".dxf") {
      const text = data.toString("utf8").replace(/^\uFEFF/, "");
      return /(^|\r?\n)\s*0\s*\r?\n\s*SECTION\s*(\r?\n|$)/i.test(text);
    }
    return false;
  }

  private hash(path: string) {
    return new Promise<string>((resolveHash, reject) => {
      const digest = createHash("sha256");
      const stream = createReadStream(path);
      stream.on("data", (chunk) => digest.update(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolveHash(digest.digest("hex")));
    });
  }

  private safeOriginalName(value: string) {
    return basename(value)
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, 255) || "archivo";
  }

  private safeStoragePath(value: string) {
    const candidate = resolve(value);
    if (candidate !== this.storageRoot && !candidate.startsWith(`${this.storageRoot}${sep}`)) {
      throw new NotFoundException("Archivo no encontrado");
    }
    return candidate;
  }

  private async requireWork(companyId: string, workId: string) {
    const work = await this.prisma.work.findFirst({
      where: { id: workId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!work) throw new NotFoundException("Obra no encontrada");
  }

  private async requireDocument(companyId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [{ workId: null }, { work: { companyId } }],
      },
    });
    if (!document) throw new NotFoundException("Documento no encontrado");
    return document;
  }
}
