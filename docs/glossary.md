# Glossary — زبان مشترک

The ubiquitous language. One concept, one Persian term, one code identifier.
Introducing a new term means adding a row here (`.claude/rules/docs.md`).

Persian is what the storefront shows; the code identifier is what the API,
the database and every module use. The API speaks English (spec §5.5) — the
Persian column never appears in `apps/api`.

| Persian      | English         | Code identifier  |
| ------------ | --------------- | ---------------- |
| مکمل         | supplement      | —                |
| برند         | brand           | `Brand`          |
| دسته‌بندی    | category        | `Category`       |
| محصول        | product         | `Product`        |
| تنوع / گونه  | variant         | `ProductVariant` |
| طعم          | flavor          | `Flavor`         |
| موجودی       | stock           | `Stock`          |
| سبد خرید     | cart            | `Cart`           |
| تسویه‌حساب   | checkout        | `Checkout`       |
| سفارش        | order           | `Order`          |
| ارسال        | shipping        | `Shipment`       |
| مشتری        | customer        | `Customer`       |
| کد تخفیف     | discount code   | `DiscountCode`   |
| فاکتور       | invoice         | `Invoice`        |
| درگاه پرداخت | payment gateway | `PaymentGateway` |
| اینماد       | enamad          | —                |

Notes:

- **تنوع / گونه (variant)** is the only sellable unit. A محصول (product) is
  never sold directly — see the invariants in
  [architecture/north-star.md](architecture/north-star.md).
- **اینماد (enamad)** and **مکمل (supplement)** have no code identifier: the
  first is a regulatory badge, the second is what the whole catalogue is.
