# 0011. No online payment at launch; a WhatsApp handoff in checkout

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

An online gateway requires enamad, a Shaparak facilitator relationship and — for supplements — a licensing position that is not yet settled. None of that is in place, and waiting for it would block the entire storefront.

## Considered Options

- **WhatsApp handoff** — checkout assembles the order and hands it to a WhatsApp conversation.
- **Wait for a gateway** before launching at all.
- **Cash on delivery** implemented in the orders module.

## Decision Outcome

Chosen: **WhatsApp handoff**. The catalogue is the valuable part and it can ship now. Payments remains a designed bounded context with a clean port, but nothing is wired to it — no adapter, no attempts table, no gateway credentials. This also keeps the site catalogue-first, which is the right posture while the licensing question in `regulatory.md` is open.

### Consequences

- Good: The storefront ships without waiting on enamad or a facilitator.
- Good: No payment credentials exist to leak from a public repository.
- Good: The payments seam is designed, so adding Zibal or PayStar later is an adapter, not a redesign.
- Bad: Orders are completed out of band, so the system has no record of payment.
- Bad: Conversion is worse than a real checkout.
- Bad: The handoff logic itself still needs its own spec.
