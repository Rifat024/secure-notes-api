// Nest loads @fastify/static lazily to serve the Swagger UI assets; importing it here makes
// serverless bundlers (Vercel's file tracer) ship it with the function.
import '@fastify/static';
import { Logger } from '@nestjs/common';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const DOCS_PATH = 'api/docs';
export const DOCS_JSON_PATH = 'api/docs-json';

/** The Swagger UI loads its own scripts, styles, and inline images, which the API's CSP forbids. */
export const DOCS_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const DESCRIPTION = `
REST API for a secure note-taking platform with JWT authentication and role-based access control.

**Authentication** — call \`POST /api/auth/login\` (demo admin: \`admin@example.com\` / \`Admin@12345\`,
demo user: \`alice@example.com\` / \`User@12345\`), then click **Authorize** and paste the \`token\`.

**Roles** — *users* manage their own notes; *admins* also manage users and can read everyone's notes.

**Pagination** — every list accepts \`page\` (default 1) and \`limit\` (default 10, max 100) and returns
\`{ items, page, limit, total, totalPages }\`.

**Errors** — always \`{ error, details? }\`. 429 responses carry \`Retry-After\`.

**Brute-force protection** — 5 wrong passwords lock an account for 15 minutes; 10 failures from one IP
block it for 30 minutes.
`;

export function setupSwagger(app: NestFastifyApplication): void {
  if (process.env.SWAGGER_ENABLED === 'false') return;
  try {
    const config = new DocumentBuilder()
      .setTitle('Secure Notes API')
      .setDescription(DESCRIPTION.trim())
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token from POST /api/auth/login' }, 'jwt')
      .addTag('Auth', 'Registration, sign-in, sessions, and own profile')
      .addTag('Notes', 'Private notes owned by the caller')
      .addTag('Posts', 'Public posts')
      .addTag('Users & aggregations', 'Profiles and the two MongoDB aggregation scenarios')
      .addTag('Admin', 'User management and everyone\'s notes (admin only)')
      .addTag('Health')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    // The bare API URL opens the documentation instead of a 404.
    app.getHttpAdapter().getInstance().get('/', (_request, reply) => reply.redirect(`/${DOCS_PATH}`, 302));
    SwaggerModule.setup(DOCS_PATH, app, document, {
      jsonDocumentUrl: DOCS_JSON_PATH,
      customSiteTitle: 'Secure Notes API docs',
      swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tagsSorter: 'alpha', docExpansion: 'list' },
    });
  } catch (error) {
    Logger.error(`Swagger setup failed: ${error instanceof Error ? error.message : String(error)}`, 'Swagger');
  }
}
