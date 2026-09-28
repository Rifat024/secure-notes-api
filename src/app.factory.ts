import helmet from '@fastify/helmet';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { createAppLogger } from './common/logging/app-logger';
import { registerRequestLogging } from './common/logging/request-logging';
import { registerJsonParser } from './common/http/json-parser';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { AppConfig, appConfig } from './config/app.config';
import { SECURITY } from './config/security.config';

/** Builds the configured Fastify application; shared by the server, the Vercel handler, and tests. */
export async function createApp(): Promise<NestFastifyApplication> {
  try {
    return await buildApp();
  } catch (error) {
    Logger.error(error instanceof Error ? error.stack : String(error), 'AppFactory');
    throw error;
  }
}

async function buildApp(): Promise<NestFastifyApplication> {
  // Only listed proxies may set X-Forwarded-For; on Vercel the edge header is used instead (see clientIp).
  const trustProxy = (process.env.TRUST_PROXY ?? 'loopback').split(',').map((entry) => entry.trim());
  const adapter = new FastifyAdapter({ trustProxy, bodyLimit: SECURITY.bodyLimitBytes });
  // Body parsing is owned by registerJsonParser, so Nest's default parser is disabled.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { logger: createAppLogger(), bodyParser: false });
  const config: AppConfig = appConfig();

  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } },
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    xFrameOptions: { action: 'deny' },
  });
  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || (config?.corsOrigins ?? []).includes(origin)),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Retry-After'],
    maxAge: 600,
  });

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', async (_request, reply) => {
    reply?.header('Cache-Control', 'no-store');
  });
  registerRequestLogging(fastify);
  registerJsonParser(fastify);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(createValidationPipe());
  return app;
}
