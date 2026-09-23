# Regulatory notes

Facts and dates, with sources. Not advice. Each item records when it was last
checked, because several of these change without notice.

## Supplement sales and licensing (Iran FDA)

As of **13 Jun 2026**, Iranian rules restrict online sale of dietary
supplements to entities holding the appropriate FDO or pharmacy licence.

**This is a business risk owned by Saman**, not a technical constraint. The
foundation's response is architectural: the storefront is catalogue-first and
checkout ends in a WhatsApp handoff rather than an online sale, so the site
does not itself transact. Revisit before any payment gateway is wired.

_Last checked: 2026-08-27._

## enamad (اینماد)

The Iranian e-commerce trust seal. Required in practice for a consumer
storefront and a prerequisite for most payment facilitators. Not started —
application happens in the go-live runbook, after the domain exists.

_Last checked: 2026-08-27._

## TTAC

The Iranian track-and-trace system for health products. Relevant once real
product records with regulatory identifiers exist; not at foundation.

_Last checked: 2026-08-27._

## Rial redenomination

A redenomination changes what a displayed price means without changing the
stored amount. The foundation stores `amountMinor bigint` in **IRR** and
treats the display unit as configurable, so a redenomination is a formatting
change in `@ds/persian`, not a data migration.

_Last checked: 2026-08-27._

## Half-price domestic traffic (ترافیک نیم‌بها)

Requires hosting inside an Iranian data centre and registration with
ito.gov.ir. Part of the go-live runbook.

_Last checked: 2026-08-27._
