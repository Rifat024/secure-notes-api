// Vercel function entry: delegates to the compiled NestJS + Fastify handler (npm run build).
module.exports = require('../dist/serverless').default;
