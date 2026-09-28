# Secure Notes API

A REST API for a note-taking app, built with **NestJS on Fastify**. It covers JWT authentication, role-based access control, brute-force protection, and a deliberately minimal set of MongoDB indexes. Every list endpoint is paginated, and every read is served by an index.

- **Stack:** NestJS 11 on Fastify 5, MongoDB with Mongoose 8, JWT (HS256), bcrypt (cost 12), class-validator DTOs, `@fastify/helmet`, `@nestjs/throttler`
- **Frontend:** [secure-notes-web](https://github.com/Rifat024/secure-notes-web)
- **API docs (Swagger):** [secure-notes-api-ebon.vercel.app/api/docs](https://secure-notes-api-ebon.vercel.app/api/docs); the raw OpenAPI spec is at `/api/docs-json`

## Run locally

```bash
cp .env.example .env        # set MONGODB_URI and a random JWT_SECRET of 32+ characters
npm install
npm run seed                # admin, 6 users with interests, notes, posts
npm run dev                 # http://localhost:4000 (watch mode)
npm test                    # 97 tests: 63 unit + 34 integration on an in-memory MongoDB
npm run explain             # prints the winning query plan for every query and aggregation
npm run e2e                 # end-to-end checks against a running API (API_URL=...)
```

Seeded accounts: `admin@example.com` / `Admin@12345` (admin). Six users (`alice@`, `bilal@`, `chaity@`, `dipto@`, `esha@`, `farhan@example.com`) share the password `User@12345`.

## Project structure

Each feature is a Nest module. Controllers handle HTTP, services hold the business rules, and **repositories hold every database query**. No service or controller touches a Mongoose model directly.

```
src/
├── main.ts                     HTTP server entry
├── serverless.ts               Vercel entry (app built once per warm instance)
├── app.factory.ts              Fastify adapter, @fastify/helmet, CORS, JSON parser, global pipe
├── app.module.ts               global guards (throttler → JWT → roles), filter, interceptor
├── config/                     env validation, app config, security constants
├── database/                   Mongoose connection + syncIndexes() on bootstrap
├── common/
│   ├── swagger/                OpenAPI document, UI setup, docs-only CSP
│   ├── decorators/             @Public, @Roles, @CurrentUser, @ApiErrors
│   ├── guards/                 JwtAuthGuard, RolesGuard, AppThrottlerGuard
│   ├── filters/                AllExceptionsFilter → { error, details? }
│   ├── pipes/                  ValidationPipe factory, ParseObjectIdPipe
│   ├── dto/                    pagination DTO, password policy, transforms
│   ├── database/               rethrowDbError: driver error → HTTP exception
│   ├── logging/                leveled logger, @Traced(), call and request logging
│   └── http/, utils/           JSON parser, client IP, pagination, rethrow
├── auth/                       controller, service, login guard, login-throttle repository
├── users/                      controller, service, repository, schema, aggregation pipelines
├── notes/                      controller, service, repository, schema, DTOs
├── posts/                      controller, service, repository, schema, DTOs
├── admin/                      admin users + admin notes controllers
├── health/
└── cli/                        seed.ts, explain.ts (standalone Nest contexts)
test/app.e2e-spec.ts            integration suite (real Fastify app + in-memory MongoDB, docs included)
scripts/                        deploy.sh, e2e.js
```

**Error handling:**

- Every repository method wraps its query in try/catch and translates driver errors with `rethrowDbError`:
  - a duplicate key becomes 409
  - a cast or validation error becomes 400
  - a lost connection becomes 503
  - anything else becomes a logged 500
- Every service, controller, guard, and pipe wraps its logic in try/catch with `rethrow`. It lets intentional HTTP errors pass through unchanged and turns anything unexpected into a logged 500, tagged with the class and method name.
- `AllExceptionsFilter` renders every error as `{ error, details? }` and never includes stack traces.

## API documentation

Interactive Swagger UI is served at **`/api/docs`**, and the bare API URL redirects there. The OpenAPI 3 document is at **`/api/docs-json`**.

- Request schemas come from the same `class-validator` DTOs that validate requests (via the `@nestjs/swagger` compiler plugin), so the docs can't drift from the validation rules.
- Response models, the `{ error, details? }` error shape, and the status codes each endpoint can return are declared explicitly.
- To call protected endpoints: run `POST /api/auth/login` (its example body is the demo admin), click **Authorize**, and paste the token. The token persists across page reloads.
- The docs page has its own content security policy that allows Swagger's scripts and styles. Every API response keeps `default-src 'none'`.
- Set `SWAGGER_ENABLED=false` to turn the docs off.

## Roles

| Capability | User | Admin |
|---|:-:|:-:|
| Create, update, delete, and list **own** notes | ✅ | ✅ |
| View a single note | own only | any |
| Create posts, read all posts, view any user's posts | ✅ | ✅ |
| Delete a post | own only | any |
| Add, update, remove, and list users | – | ✅ |
| List **everyone's** notes (optionally by owner) | – | ✅ |

Roles are enforced by global guards:

- `JwtAuthGuard` authenticates every route except those marked `@Public()`.
- `RolesGuard` checks `@Roles(Role.Admin)` on the admin controllers.

A note's owner always comes from the JWT. Unknown request fields are rejected (`forbidNonWhitelisted`), so no one can set `role` or `owner` through the body. The role and token version are re-read on every request, so a demotion, a deletion, or a logout takes effect immediately. Admins can't delete or demote their own account. Deleting a user also deletes their notes and posts.

## Endpoints

All list endpoints accept `?page=` (default 1) and `?limit=` (default 10, max 100). They return `{ items, page, limit, total, totalPages }`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/docs` · `/api/docs-json` | – | Swagger UI · OpenAPI document |
| GET | `/api/health` | – | Liveness check |
| POST | `/api/auth/register` | – | Create an account; returns `{ token, user }` |
| POST | `/api/auth/login` | – | Returns `{ token, user }` |
| POST | `/api/auth/logout` | user | Revokes every token issued to the user |
| GET / PATCH | `/api/auth/me` | user | Own profile; update name, password, interests |
| GET / POST | `/api/notes` | user | List own notes (paginated) / create a note |
| GET / PATCH / DELETE | `/api/notes/:id` | user | Own note (admins may GET any note) |
| GET / POST | `/api/posts` | user | All posts (paginated) / create a post |
| GET / DELETE | `/api/posts/:id` | user | Read any post / delete as author or admin |
| GET | `/api/users/:id` | user | Public profile |
| GET | `/api/users/interests` | user | **Aggregation scenario 1**: users grouped by interest (`?interest=` optional) |
| GET | `/api/users/:id/posts` | user | **Aggregation scenario 2**: a user's posts via `$lookup` |
| GET / POST | `/api/admin/users` | admin | List users (paginated) / add a user |
| GET / PATCH / DELETE | `/api/admin/users/:id` | admin | Read / update / remove a user |
| GET | `/api/admin/notes` | admin | Everyone's notes (paginated, optional `?owner=`) |

## Indexing strategy

The schemas declare every index with `schema.index()`. `autoIndex` is off. `syncIndexes()` runs at startup, so the database always matches the code: any index that is no longer declared gets dropped. There are four indexes beyond `_id`:

| Collection | Index | Queries it serves |
|---|---|---|
| users | `{ email: 1 }` unique | Login lookup; blocks duplicate accounts |
| users | `{ interests: 1 }` (multikey) | First `$match` of aggregation scenario 1, and the `?interest=` filter |
| notes | `{ owner: 1, _id: -1 }` | A user's notes: equality on owner plus a newest-first sort in a single index scan, with no in-memory sort. Also serves the note count (`COUNT_SCAN`) and the admin `?owner=` filter |
| posts | `{ author: 1, _id: -1 }` | Aggregation scenario 2: `$lookup` foreignField, the sorted page of posts, and the post count (covered, 0 documents examined) |

**Indexes I left out on purpose:**

- **`createdAt`:** `_id` is an ObjectId, so it already grows with creation time. Newest-first lists (the admin user list, all notes, the post feed) sort on `{ _id: -1 }` and use the built-in `_id` index.
- **`notes { _id, owner }`:** an owner-scoped get, update, or delete filters on the unique `_id` first. The owner check then runs on that single document.
- **`role`, `name`, `title`:** nothing filters or sorts on these fields.
- **A separate `{ owner: 1 }` or `{ author: 1 }` index:** the compound indexes already start with these fields.
- **The `loginthrottles` collection:** the client IP is the `_id`, so brute-force tracking needs no extra index.
- **Unfiltered counts:** these use `estimatedDocumentCount()`, which reads collection metadata instead of scanning.

`npm run explain` prints the winning plan for every query and exits with an error on a `COLLSCAN`, an in-memory `SORT`, or a `$lookup` without an index. It passes on both local MongoDB and the production Atlas cluster:

```
 ok   login: users by email                        IXSCAN(email_1)
 ok   profile: user by _id                         EXPRESS_IXSCAN(_id_)
 ok   admin list users (sort _id desc)             IXSCAN(_id_)
 ok   list my notes (owner, sort _id desc)         IXSCAN(owner_1__id_-1)
 ok   count my notes                               COUNT_SCAN(owner_1__id_-1)
 ok   get note (_id + owner)                       IXSCAN(_id_)
 ok   admin list all notes (sort _id desc)         IXSCAN(_id_)
 ok   admin notes filtered by owner                IXSCAN(owner_1__id_-1)
 ok   list posts (sort _id desc)                   IXSCAN(_id_)
 ok   get post by _id                              EXPRESS_IXSCAN(_id_)
 ok   scenario 1: users grouped by interest        IXSCAN(interests_1)
 ok   scenario 1: filtered to one interest         IXSCAN(interests_1)
 ok   scenario 2: user posts via $lookup           EXPRESS_IXSCAN(_id_) <- $lookup posts(author_1__id_-1) <- $lookup postCount(author_1__id_-1, docsExamined=0)
```

The test suites also assert that the declared and the actual indexes are exactly this set.

## Aggregations

Both pipelines live in [`src/users/pipelines`](src/users/pipelines). They run through `UsersRepository`.

### Scenario 1: users grouped by interest

A single `aggregate()` call does all the work. There is no follow-up `find` or `count`, and no grouping in application code:

```
$match   { interests: { $gt: "" } }        ← IXSCAN interests_1 (skips users with no interests)
$project { name, email, interests }
$unwind  $interests
$group   { _id: "$interests", count: { $sum: 1 }, users: { $push: { _id, name, email } } }
$sort    { count: -1, _id: 1 }
$facet   { items: [$skip, $limit], meta: [$count] }   ← page and total in the same round trip
```

With `?interest=chess`, the first stage becomes a point lookup on the same index. A second `$match` after `$unwind` then keeps only that interest's group.

### Scenario 2: a user's posts with `$lookup`

One pipeline on `users`:

```
$match  { _id }                                         ← _id index
$lookup { from: "posts", localField: "_id", foreignField: "author",
          pipeline: [$sort {_id:-1}, $skip, $limit], as: "posts" }   ← author_1__id_-1
$lookup { ... pipeline: [$count], as: "postCount" }     ← covered by author_1__id_-1
$project { author, posts, total }
```

## Security

| Layer | Protection |
|---|---|
| Passwords | bcrypt cost 12. The policy requires 8–72 characters with a letter and a number. The hash has `select: false` and is removed in `toJSON`. |
| Tokens | HS256 with the algorithm, issuer, and audience pinned; 8-hour expiry. A `tokenVersion` claim is checked on every request, so a logout, password change, or role change revokes all existing tokens. |
| Account lockout | 5 wrong passwords lock the account for 15 minutes (429 with `Retry-After`). The counter is updated atomically in MongoDB. |
| IP blocking | 10 failed sign-ins from one IP within 15 minutes block that IP from signing in for 30 minutes. The block is stored in MongoDB, so it holds across every serverless instance. |
| Rate limiting | `@nestjs/throttler` allows 300 requests per 15 minutes per IP globally, 20 per 15 minutes for login, and 10 accounts per hour for registration. The limits are keyed on Vercel's edge IP header, which callers can't spoof. |
| Enumeration | An unknown email is compared against a dummy hash and gets the same 401, so response timing doesn't reveal whether an account exists. |
| Input | Whitelisted DTOs reject unknown fields and operator objects. The JSON parser uses `secure-json-parse` to block prototype poisoning. Request bodies are capped at 100 kb. |
| Headers | `@fastify/helmet` sets a strict CSP (`default-src 'none'`), HSTS preload, `X-Frame-Options: DENY`, and `Referrer-Policy: no-referrer`. Every response carries `Cache-Control: no-store`. CORS is limited to an allowlist. |
| Proxies | `X-Forwarded-For` is honoured only from `TRUST_PROXY` addresses. Fastify is pinned to a version that fixes the hop-count spoofing advisory (GHSA-3m5p-2c4r-xxw2). |
| Errors | Stack traces are never sent to clients. Database errors are mapped to safe HTTP statuses. |

## Logging

`LOG_LEVEL` sets the verbosity (`fatal`, `error`, `warn`, `log`, `debug`, or `verbose`). Each level also enables every more severe level. Production writes one JSON object per line; development writes readable coloured output.

| Level | What is logged |
|---|---|
| `error` | Unexpected failures with stack traces, logged once where they happen |
| `warn` | 4xx responses; security events (`login_failed`, `account_locked`, `ip_blocked`, `rate_limited`, `forbidden`) |
| `log` | One line per request (method, path, status, duration, client IP); startup |
| `debug` | Each controller, service, and repository call finishing, with its duration and outcome |
| `verbose` | Each call starting |

Services and repositories are traced by the `@Traced()` class decorator, and controllers by `CallLoggingInterceptor`. Arguments are never logged, so passwords and tokens can't reach the logs.

## Deploy (Vercel)

`npm run build` compiles to `dist/`. `api/index.js` exposes `dist/serverless.js`, which builds the Nest application once per warm instance and passes requests to Fastify.

```bash
cp .env.production.example .env.production   # MONGODB_URI, CORS_ORIGIN, optional JWT_SECRET
npm run deploy                                # add "-- --seed" to load the demo data
```

[`scripts/deploy.sh`](scripts/deploy.sh) runs these steps in order:

1. Runs the tests and the build.
2. Pings MongoDB.
3. Syncs the environment variables to Vercel. `JWT_SECRET` is generated only on the first deploy.
4. Deploys to production.
5. Seeds the database, when `--seed` is passed.
6. Smoke-tests the live API.

MongoDB Atlas **Network Access** must allow `0.0.0.0/0`, because Vercel functions don't use fixed IP addresses.
