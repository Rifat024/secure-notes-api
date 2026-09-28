import { Logger } from '@nestjs/common';
import type { FastifyInstance } from 'fastify';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app.factory';

let instance: Promise<FastifyInstance> | undefined;

async function init(): Promise<FastifyInstance> {
  const app = await createApp();
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  await fastify.ready();
  return fastify;
}

/** Vercel entry point: the Nest application is built once per warm instance and reused. */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    instance ??= init();
    const fastify = await instance;
    fastify.server.emit('request', req, res);
  } catch (error) {
    instance = undefined;
    Logger.error(error instanceof Error ? error.stack : String(error), 'Serverless');
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Service temporarily unavailable' }));
  }
}
