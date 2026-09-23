# 0008. Money as IRR minor units with a configurable display unit

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

Prices must survive arithmetic, storage and a possible rial redenomination. Iranians quote prices in Toman while the currency is the Rial, and floating-point arithmetic on money is a known source of silent error.

## Considered Options

- **`amountMinor bigint` plus `currency char(3)`**, with Toman as a display conversion.
- **Store Toman** as the customer sees it.
- **`numeric`/decimal** columns.

## Decision Outcome

Chosen: **IRR minor units in a `bigint`**, with a shared `Money` value object for construction, addition, comparison and integer multiplication. Toman is produced only at the edge by `formatToman()` in `@ds/persian`, which divides by ten and renders Persian digits. Storing Toman would bake a display convention into the data; a redenomination would then be a migration instead of a formatting change.

### Consequences

- Good: No floating-point money anywhere.
- Good: A redenomination is a change in `@ds/persian`, not a data migration.
- Good: `bigint` has ample headroom for rial amounts.
- Bad: Every read path must format deliberately; a raw amount shown to a customer is off by 10x.
- Bad: Allocation (splitting a total across lines) is not implemented until pricing needs it.
