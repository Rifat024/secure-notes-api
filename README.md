# Secure Notes API

REST API for a note-taking app with JWT authentication, role-based access control, and a deliberately minimal set of MongoDB indexes. Every list endpoint is paginated, and every read is served by an index.

- **Stack:** Node.js 20+, Express 5, MongoDB with Mongoose 8, JWT (HS256), bcrypt (cost 12), zod validation
- **Frontend:** [secure-notes-web](https://github.com/Rifat024/secure-notes-web)

## Run locally

```bash
cp .env.example .env        # set MONGODB_URI and a long random JWT_SECRET
npm install
npm run seed                # admin, 6 users with interests, notes, posts
npm run dev                 # http://localhost:4000
npm test                    # 66 tests: 46 unit + 20 integration on an in-memory MongoDB
npm run test:unit           # unit tests only (no database)
npm run explain             # prints the winning query plan for every query and aggregation
```

Seeded accounts: `admin@example.com` / `Admin@12345` (admin). Six users (`alice@`, `bilal@`, `chaity@`, `dipto@`, `esha@`, `farhan@example.com`) share the password `User@12345`.

## Roles

| Capability | User | Admin |
|---|:-:|:-:|
| Create, update, delete, and list **own** notes | ✅ | ✅ |
| View a single note | own only | any |
| Create posts, read all posts, view posts of any user | ✅ | ✅ |
| Delete a post | own only | any |
| Add, update, remove, and list users | – | ✅ |
| List **everyone's** notes (optionally by owner) | – | ✅ |

Roles are enforced on the server. The note owner always comes from the verified JWT, never from the request body. Registration can't set a role. The role is re-read from the database on each request, so a demotion or deletion takes effect right away. An admin can't delete or demote their own account. Deleting a user also deletes that user's notes and posts.

## Endpoints

All list endpoints take `?page=` (default 1) and `?limit=` (default 10, max 100). They return `{ items, page, limit, total, totalPages }`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | – | Create a user account; returns `{ token, user }` |
| POST | `/api/auth/login` | – | Returns `{ token, user }` |
| GET / PATCH | `/api/auth/me` | user | Own profile; update name, password, interests |
| GET | `/api/notes` | user | List own notes (paginated) |
| POST | `/api/notes` | user | Create a note |
| GET / PATCH / DELETE | `/api/notes/:id` | user | Own note (admins can also GET any note) |
| GET | `/api/posts` | user | All posts (paginated) |
| POST | `/api/posts` | user | Create a post |
| GET / DELETE | `/api/posts/:id` | user | Read a post; delete it as author or admin |
| GET | `/api/users/:id` | user | Public profile |
| GET | `/api/users/interests` | user | **Aggregation scenario 1**: users grouped by interest (`?interest=` optional) |
| GET | `/api/users/:id/posts` | user | **Aggregation scenario 2**: a user's posts via `$lookup` |
| GET / POST | `/api/admin/users` | admin | List users (paginated) / add a user |
| GET / PATCH / DELETE | `/api/admin/users/:id` | admin | Read / update / remove a user |
| GET | `/api/admin/notes` | admin | Everyone's notes (paginated, optional `?owner=`) |

## Indexing strategy

The schemas declare every index with `schema.index()` ([src/models](src/models)). `autoIndex` is off. `syncIndexes()` runs at startup so the database matches the code exactly. There are four indexes beyond the default `_id`:

| Collection | Index | Queries it serves |
|---|---|---|
| users | `{ email: 1 }` unique | Login lookup; blocks duplicate accounts |
| users | `{ interests: 1 }` (multikey) | First `$match` of aggregation scenario 1, and the `?interest=` filter |
| notes | `{ owner: 1, _id: -1 }` | A user's note list: equality on owner plus a newest-first sort in one index scan, with no in-memory sort. Also serves the note count (`COUNT_SCAN`) and the admin `?owner=` filter |
| posts | `{ author: 1, _id: -1 }` | Aggregation scenario 2: `$lookup` foreignField, the sorted page of posts, and the post count (covered, 0 documents examined) |

**Indexes I left out on purpose, and why:**

- **`createdAt` on any collection.** `_id` is an ObjectId, so its value already grows with creation time. "Newest first" lists sort on `{ _id: -1 }` and use the built-in `_id` index. This covers the admin user list, the admin list of all notes, and the post feed.
- **`notes { _id, owner }`.** Owner-scoped get, update, and delete filter on `_id`, which is unique. The `_id` index finds the one document, and the owner check runs on that document.
- **`users.role`, `users.name`, `notes.title`, `posts.title`.** No query filters or sorts on these fields.
- **A separate `notes { owner: 1 }` or `posts { author: 1 }`.** The compound indexes already start with these fields, so a separate index would add nothing.
- **Unfiltered counts.** These use `estimatedDocumentCount()`, which reads collection metadata instead of scanning.

`npm run explain` prints the winning plan for every query and fails if a plan contains `COLLSCAN`, an in-memory `SORT`, or a `$lookup` without an index:

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

The test suite also asserts that each collection has exactly these indexes, so any extra index fails the build.

## Aggregations

Both pipelines live in [src/services/aggregations.js](src/services/aggregations.js).

### Scenario 1: users grouped by interest

One `User.aggregate()` call (Mongoose's wrapper around `collection.aggregate()`) does all the work. There is no follow-up `find` or `count`, and no grouping in application code:

```
$match   { interests: { $gt: "" } }        ← IXSCAN interests_1 (skips users with no interests)
$project { name, email, interests }
$unwind  $interests
$group   { _id: "$interests", count: { $sum: 1 }, users: { $push: { _id, name, email } } }
$sort    { count: -1, _id: 1 }
$facet   { items: [$skip, $limit], meta: [$count] }   ← pagination + total in the same round trip
```

With `?interest=chess`, the first stage becomes `{ interests: "chess" }`, which is a point lookup on the same index. A second `$match` after `$unwind` then keeps only that interest's group.

### Scenario 2: posts of a user with `$lookup`

This is one pipeline on the `users` collection:

```
$match  { _id }                                         ← _id index
$lookup { from: "posts", localField: "_id", foreignField: "author",
          pipeline: [$sort {_id:-1}, $skip, $limit], as: "posts" }   ← author_1__id_-1
$lookup { ... pipeline: [$count], as: "postCount" }     ← covered by author_1__id_-1
$project { author, posts, total }
```

The response includes the author, one page of the author's posts (newest first), and the total count. The pipeline returns 404 when the user doesn't exist.

## Security

- Passwords are hashed with bcrypt (cost 12). The `password` field has `select: false` and is removed in `toJSON`, so it never appears in a response.
- JWTs are signed with HS256 and verification pins the algorithm. In production, `JWT_SECRET` must be at least 32 characters or the app won't start.
- Login compares against a dummy hash when the email is unknown, so response timing doesn't reveal which emails are registered.
- Auth endpoints are rate-limited to 20 requests per 15 minutes per IP.
- Every body, param, and query is validated with strict zod schemas. Unknown keys are rejected, so operator payloads like `{"$gt": ""}` never reach MongoDB. Ids are checked to be ObjectIds.
- The API uses `helmet`, a CORS allowlist (`CORS_ORIGIN`), and a 100 kb JSON body limit. Error responses never include stack traces.

## Deploy (Vercel)

`api/index.js` exports the Express app as a serverless function and caches the Mongo connection between invocations. `vercel.json` routes every path to that function.

```bash
cp .env.production.example .env.production   # MONGODB_URI, CORS_ORIGIN, optional JWT_SECRET
npm run deploy                                # add "-- --seed" to load the demo data
```

[`scripts/deploy.sh`](scripts/deploy.sh) runs these steps:

1. Checks that the Vercel CLI is installed and logged in.
2. Pings MongoDB and stops before changing anything if the database is unreachable.
3. Sets `MONGODB_URI` and `CORS_ORIGIN` on the Vercel project. It keeps an existing `JWT_SECRET` so issued tokens stay valid, and generates one on the first deploy.
4. Deploys to production and optionally seeds the database.
5. Smoke-tests the live API: `/api/health` must return 200, and a login with an unknown email must return 401, which proves the database is reachable.

In MongoDB Atlas, **Network Access** must allow `0.0.0.0/0`. Vercel functions don't use fixed IP addresses.
