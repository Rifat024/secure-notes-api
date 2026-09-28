import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp({ beforeRoutes } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || env.corsOrigins.includes(origin)),
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Retry-After', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  if (beforeRoutes) app.use(beforeRoutes);

  app.get('/', (_req, res) => res.json({ name: 'secure-notes-api', docs: '/api/health' }));
  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
