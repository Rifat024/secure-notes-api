import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import { createApp } from '../src/app.js';

const app = createApp({
  beforeRoutes: async (_req, _res, next) => {
    try {
      await connectDB(env.mongoUri);
      next();
    } catch (err) {
      next(err);
    }
  },
});

export default app;
