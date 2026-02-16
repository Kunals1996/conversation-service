# Conversation Session Service

Backend service for a Voice Owl AI platform: manage conversation sessions and their events.

**Stack:** TypeScript, NestJS 11, MongoDB (Mongoose 9), class-validator/class-transformer.

## Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier)

### Install

```bash
npm install
```

### MongoDB

- **Local:** Run MongoDB on `localhost:27017`. Default connection string: `mongodb://localhost:27017/conversation-service`.
- **MongoDB Atlas (free tier):** See **[MONGODB_SETUP.md](./MONGODB_SETUP.md)** for step-by-step instructions (create cluster, user, get URI). You do **not** need to create collections—Mongoose creates `sessions` and `events` on first use.

### Environment

Create a `.env` file in the project root (optional):

```env
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/conversation-service?retryWrites=true&w=majority
```

If `MONGODB_URI` is not set, the app falls back to `mongodb://localhost:27017/conversation-service`.

## Run the project

```bash
# Development (watch mode)
npm run start:dev

# One-off run
npm run start
```

Server listens on `http://localhost:3000` (or `PORT` from env).

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions` | Create or return existing session (idempotent) |
| POST | `/sessions/:sessionId/events` | Add event to session (idempotent by `eventId`) |
| GET | `/sessions/:sessionId` | Get session and events (paginated) |
| POST | `/sessions/:sessionId/complete` | Mark session completed (idempotent) |

### Examples

### Create or upsert session

```bash
curl -X POST http://localhost:3000/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"s1","language":"en","metadata":{}}'
```

### Add event

```bash
curl -X POST http://localhost:3000/sessions/s1/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "e1",
    "type": "user_speech",
    "payload": {
      "text": "Hi, I need help booking a flight",
      "language": "en-US"
    },
    "timestamp": "2025-02-15T12:00:00.000Z"
  }'
```

### Get session with events (pagination: limit, offset)

```bash
curl "http://localhost:3000/sessions/s1?limit=20&offset=0"
```

### Complete session

```bash
curl -X POST http://localhost:3000/sessions/s1/complete
```

## Assumptions

- `sessionId` and `eventId` are provided by the client (externally generated).
- Session status values: `initiated`, `active`, `completed`, `failed`.
- Event types: `user_speech`, `bot_speech`, `system`.
- Pagination for events uses `limit` (default 20, max 100) and `offset` (default 0).
- No authentication; the service is intended for evaluation and local/trusted use.
- Events can be created even after the session is marked as ended or completed.

## Behavior and implementation details

- **Idempotency**
  - `POST /sessions`:
    - Uses `findOneAndUpdate` with `upsert: true` and `$setOnInsert` so only one session per `sessionId` is created and all callers get the same document.
  - `POST /sessions/:sessionId/events`:
    - Uses a unique index on `(sessionId, eventId)` plus a pre-check and duplicate-key handling to ensure only one event is stored per pair; retries with the existing event on duplicates.
  - `POST /sessions/:sessionId/complete`:
    - Updates only when `status !== 'completed'`, so multiple calls all result in a single completed session document.

- **Pagination**
  - `GET /sessions/:sessionId` accepts:
    - `limit` (1–100, default 20).
    - `offset` (≥ 0, default 0).
  - Response includes:
    - `session`: the session document.
    - `events`: current page of events for that session.
    - `pagination`: `{ total, limit, offset }`.

- **Validation**
  - Global `ValidationPipe`:
    - `whitelist: true` (strip unknown properties).
    - `forbidNonWhitelisted: true` (reject payloads with extra fields).
    - `transform: true` (convert primitives to DTO types).
  - DTOs:
    - `CreateSessionDto`: validates `sessionId`, `language`, and optional `metadata`.
    - `AddEventDto`: validates `eventId`, `type`, optional `payload`, and `timestamp` as ISO date string.
    - `GetSessionQueryDto`: validates `limit`/`offset` as integers within bounds.

- **Error handling**
  - Global `AllExceptionsFilter`:
    - Catches all unhandled exceptions.
    - Logs method, URL, status, message, and stack.
    - Returns consistent JSON error responses with `path` and `timestamp`.
  - Service throws:
    - `NotFoundException` when a session is missing.
    - `BadRequestException` for invalid timestamps.

- **Response shape**
  - Mongoose schemas configure `toJSON` to:
    - Remove `_id` and `__v` from API responses.
  - Clients see only domain fields (`sessionId`, `status`, `language`, `startedAt`, `endedAt`, `metadata`, and event fields).

## Tests

```bash
npm run test
npm run test:e2e
npm run test:cov
```

## Design

See [DESIGN.md](./DESIGN.md) for idempotency, concurrency, indexes, scaling, and scope decisions.
