# Design Document

## Sessions and events: separate collections

Sessions and events are stored in **two collections** (not embedded in one). This is the recommended approach for this kind of service.

**Why separate collections**

- **Volume and size:** One session can have many events (e.g. long voice calls). MongoDB documents have a 16MB limit. Embedding all events in a single session document would risk hitting that limit and would force awkward workarounds (e.g. bucketing).
- **Append-only, immutable events:** Events are added over time and never updated. A separate events collection fits append-only access patterns and keeps session documents small and stable.
- **Pagination:** Listing events by timestamp with `limit`/`offset` is efficient with a dedicated collection and an index on `(sessionId, timestamp)`. Paginating an embedded array is possible but less clean and can be slower.
- **Indexing and concurrency:** The unique index on `(sessionId, eventId)` in the events collection gives idempotent, concurrent-safe inserts. Embedding would require updating the same session document on every new event, increasing contention and write size.
- **Scaling:** With separate collections, events can be sharded or archived independently (e.g. by time or sessionId) without touching session documents.

**Alternative (embedded events)** would only be reasonable if each session had a small, bounded number of events and you always loaded the full list. That does not match a voice AI platform where a single call can generate many events.

No code changes are required; the current implementation already follows this design.

---

## 1. How did you ensure idempotency?

- **POST /sessions (Create or Upsert):** Implemented with MongoDB `findOneAndUpdate` using `sessionId` as the filter and `$setOnInsert` for all fields. If the session already exists, the update is a no-op and the existing document is returned. If it does not exist, a new document is inserted. Concurrent requests with the same `sessionId` all receive the same result (either the one who inserted or the existing one from a prior insert).
- **POST /sessions/:sessionId/events:** Before inserting, we check for an existing event with the same `sessionId` + `eventId`. If it exists, we return that event with 201 (same response as a new insert). We also rely on a unique compound index `{ sessionId, eventId }` so that a race condition still results in at most one document; on duplicate key error we fetch and return the existing event.
- **POST /sessions/:sessionId/complete:** We first check if the session is already completed. If so, we return the existing session without updating. If not, we update only when `status !== 'completed'` and return the updated document. Multiple calls return the same completed session.

## 2. How does your design behave under concurrent requests?

- **Create session:** `findOneAndUpdate` with `upsert: true` is atomic. Only one document per `sessionId` is ever created; concurrent requests either create the document (first writer) or match the existing one and get a no-op update. All callers get a consistent view of the session.
- **Add event:** The unique index on `(sessionId, eventId)` guarantees at most one event per pair. Concurrent inserts with the same `sessionId` and `eventId`: one succeeds, the other may get a duplicate key error (11000). The code catches that, fetches the existing event, and returns it so the API remains idempotent.
- **Complete session:** We use `findOneAndUpdate` with a condition `status !== 'completed'` so only one update can transition the session to completed. Concurrent complete requests: first wins and sets `endedAt`; subsequent ones match the already-completed document and return it without changing it.

## 3. What MongoDB indexes did you choose and why?

- **Sessions**
  - `{ sessionId: 1 }` unique — Primary lookup for all session operations; ensures one session per `sessionId`.
  - `{ status: 1 }` — For potential queries filtering by status (e.g. list active sessions).
  - `{ startedAt: -1 }` — For time-based listing or analytics.
- **Events**
  - `{ sessionId: 1, eventId: 1 }` unique — Enforces event idempotency per session and supports “find by session + eventId” for duplicate handling.
  - `{ sessionId: 1, timestamp: 1 }` — Supports “get events for session ordered by timestamp” and pagination (skip/limit) efficiently.

## 4. How would you scale this system for millions of sessions per day?

- **Database:** Use MongoDB Atlas (or similar) with a sharded cluster. Shard sessions by `sessionId` (hashed or range) so session and its events can be co-located or queried from the same shard; keep the event compound index so per-session queries remain efficient.
- **Application:** Run multiple instances behind a load balancer; the API is stateless. Use connection pooling and keep the number of indexes minimal to avoid write amplification.
- **Caching:** Optionally cache hot sessions (e.g. Redis) by `sessionId` with short TTL; invalidate on update/complete. Events could be cached per session with care for pagination and consistency.
- **Operations:** Monitor slow queries and index usage; set TTL or archival for old sessions/events if retention is limited. Consider read replicas for GET-heavy traffic.

## 5. What did you intentionally keep out of scope, and why?

- **Authentication/authorization:** Not required by the assignment; avoids extra complexity and dependencies.
- **Background jobs/queues:** Not required; all operations are synchronous and request-scoped.
- **External services:** Not required; keeps the service self-contained and easier to run and test.
- **Soft delete / audit log:** Not in the spec; sessions are completed, not deleted. Can be added later if needed.
- **Webhooks or notifications:** Out of scope to keep the solution minimal and focused on the core API and data model.
- **Constants/configuration files for strings:** Status values (`'initiated'`, `'active'`, `'completed'`, `'failed'`), event types (`'user_speech'`, `'bot_speech'`, `'system'`), and error messages are kept inline rather than extracted to a constants file. This avoids over-engineering for a small codebase where the values are used in few places and are self-documenting. If the codebase grows or these values need to be shared across multiple modules, extracting them would make sense.
- **Language as enum:** The `language` field in session creation is accepted as a free-form string (e.g., `'en-US'`, `'fr-FR'`, `'es'`) rather than an enum of supported languages. This keeps the API flexible and avoids maintaining a hardcoded list that may need frequent updates as new languages are added. Validation ensures it's a non-empty string, but doesn't restrict to a predefined set. If language validation becomes critical (e.g., for downstream processing), an enum or allowlist can be added later.

---

## 6. Request validation and error handling

- **DTO-based validation**
  - Every write and query endpoint uses DTOs with `class-validator` and `class-transformer`:
    - `CreateSessionDto` validates `sessionId` and `language` as non-empty strings and `metadata` as an optional object.
    - `AddEventDto` validates:
      - `eventId`: non-empty string.
      - `type`: one of `'user_speech' | 'bot_speech' | 'system'`.
      - `payload`: optional object.
      - `timestamp`: ISO 8601 date string.
    - `GetSessionQueryDto` validates:
      - `limit`: optional integer, 1–100, default 20.
      - `offset`: optional integer, ≥ 0, default 0.
  - A global `ValidationPipe` is registered with:
    - `whitelist: true` — strips unknown properties.
    - `forbidNonWhitelisted: true` — rejects payloads with extra fields.
    - `transform: true` — converts primitives to typed DTO fields (e.g. query strings to numbers).

- **Error handling**
  - A global `AllExceptionsFilter`:
    - Catches all thrown exceptions (both `HttpException` and unexpected errors).
    - Logs method, URL, status code, message, and stack trace.
    - Returns a consistent JSON error body:
      - Always includes `path` and `timestamp`.
      - Includes the original `HttpException` payload or a default `{ statusCode, message }` for non-HTTP errors.
  - The service throws:
    - `NotFoundException` when a session is missing for add-event, get-session, or complete-session.
    - `BadRequestException` for invalid timestamps.

## 7. Response shape and MongoDB internals

- **Hiding MongoDB internals**
  - Mongoose schemas for `Session` and `Event` configure `toJSON` transforms:
    - `versionKey: false` — omits `__v` from JSON.
    - `transform` removes the internal `_id` field.
  - As a result, API responses expose only domain fields:
    - `sessionId`, `status`, `language`, `startedAt`, `endedAt`, `metadata` for sessions.
    - `sessionId`, `eventId`, `type`, `payload`, `timestamp` for events.

- **Pagination response**
  - `GET /sessions/:sessionId` returns:
    - `session`: the session document.
    - `events`: the list of events for the current page (with Mongo fields stripped as above).
    - `pagination`: `{ total, limit, offset }`, where:
      - `total` is the total number of events for the session.
      - `limit` and `offset` echo the effective pagination parameters.

## 8. Modules and folder structure

- **Root module**
  - `AppModule`:
    - Loads configuration via `ConfigModule.forRoot({ isGlobal: true })`.
    - Configures MongoDB via `MongooseModule.forRootAsync`, using:
      - `MONGODB_URI` from env when present.
      - Fallback `mongodb://localhost:27017/conversation-service` when not.
    - Imports `SessionsModule`.
    - Registers a basic `AppController` for `GET /` (health/simple hello).

- **Sessions module**
  - `SessionsModule` wires:
    - `SessionsController` — HTTP layer under `/sessions`.
    - `SessionsService` — business logic, idempotency, pagination.
    - `SessionsRepository` — session persistence.
    - `EventsRepository` — event persistence and pagination.
    - Mongoose models for `Session` and `Event` via `MongooseModule.forFeature`.

- **Folder layout**
  - `src/sessions/dto`: DTOs for validation:
    - `create-session.dto.ts`, `add-event.dto.ts`, `get-session-query.dto.ts`.
  - `src/sessions/schemas`: Mongoose schemas:
    - `session.schema.ts`, `event.schema.ts`.
  - `src/sessions/interfaces`:
    - `session-with-events-response.interface.ts` — shape of the combined session + events response.
    - `create-session-data.interface.ts` — repository input type.
  - `src/sessions/sessions.repository.ts` and `src/sessions/repositories/events.repository.ts`:
    - Encapsulate all MongoDB access for sessions and events respectively.
  - `src/common/filters/all-exceptions.filter.ts`:
    - Global exception filter for consistent error handling and logging.
