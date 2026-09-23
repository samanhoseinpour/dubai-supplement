# 0009. A transactional outbox before any queue

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

Modules must react to each other's changes without reaching into each other's tables, and an event must not be published if the transaction that produced it rolls back.

## Considered Options

- **Transactional outbox** — events written to `outbox_events` in the same transaction as the state change, dispatched by a relay.
- **BullMQ from the start** — a Redis-backed queue with workers.
- **`@nestjs/event-emitter`** — in-process synchronous events.

## Decision Outcome

Chosen: **transactional outbox**. It is the only option where the event and the state change commit or fail together. An in-process emitter publishes events for transactions that later roll back, and a queue has the same problem plus an extra moving part. `@nestjs/event-emitter` is banned by a lint rule so it cannot creep in.

### Consequences

- Good: An event exists if and only if its state change committed.
- Good: `runOnce()` is directly callable, so relay behaviour is unit-testable without a scheduler.
- Good: Failures are visible: `attempts`, `last_error`, and a parked count on `/health/ready`.
- Bad: At-least-once delivery, so every handler must be idempotent.
- Bad: Parked events (5 failed attempts) need manual intervention; there is no dead-letter table yet.
- Bad: BullMQ arrives with the first real asynchronous job and will be fed by this same relay.
