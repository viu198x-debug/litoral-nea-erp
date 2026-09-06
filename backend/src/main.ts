import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import {
  json,
  urlencoded,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const prefix = config.get<string>("API_PREFIX", "api/v1");
  const http = app.getHttpAdapter().getInstance() as {
    disable(name: string): void;
    set(name: string, value: number): void;
  };

  http.disable("x-powered-by");
  if (config.get("TRUST_PROXY", "false") === "true") {
    http.set("trust proxy", 1);
  }
  app.setGlobalPrefix(prefix);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      hsts: config.get("NODE_ENV") === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );
  app.use(cookieParser());
  app.use(json({ limit: config.get<string>("JSON_BODY_LIMIT", "1mb") }));
  app.use(urlencoded({ extended: false, limit: "32kb", parameterLimit: 100 }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const incoming = request.get("x-request-id");
    const requestId = incoming && /^[a-zA-Z0-9._-]{8,80}$/.test(incoming)
      ? incoming
      : randomUUID();
    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);
    next();
  });
  app.enableCors({
    origin: config
      .get<string>("FRONTEND_URL", "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID", "X-Content-SHA256"],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  await app.listen(config.get<number>("PORT", 4000), "0.0.0.0");
}

void bootstrap();
