import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

await connectDB(env.mongoUri);

createApp().listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
