# Scope and assumptions

## In scope (core build)
- Retailer: SMS OTP login, catalogue (retailer price, GST shown, stock status, scheme), cart, place order, order history, repeat order
- Scheme engine: free goods (buy N get M) and slab percent discounts
- AI order capture from a text message (Gemini), with a human review step
- Order desk: email + password login, order queue, credit holds, Tally export
- Hindi and English UI

## Cut (and why)
- Voice notes and photo-of-list capture: same parser interface, extra input types; text first
- Salesman mode and offline sync: needs a sync layer, not part of the core slice
- 14-day no-order dashboard: built last if time allows
- Real payments, delivery tracking, GST e-invoicing: out of scope in the brief

## Assumptions (to be repeated in the TDD)
- A1. Dealer price in the sample data is per piece; case price = price x pieces per case (biscuit 96, detergent 20, tea 40).
- A2. Sample prices are GST-exclusive; GST is added at 12% (biscuit, tea) and 18% (detergent). Rates are invented.
- A3. Orders are in whole cases only; free goods are whole cases.
- A4. One active scheme per SKU. Free goods: floor(qty / buyQty) x freeQty. A slab applies to the whole line once qty >= minQty.
- A5. Free cases must be in stock too; an order cannot exceed available stock.
- A6. Credit check: outstanding + order total > credit limit puts the order ON_HOLD for the desk.
- A7. Retailer-specific prices are a per-SKU override; otherwise the dealer price applies.
- A8. Retailers, outstanding balances, credit limits and orders are invented seed data.
- A9. OTP via SMS (Twilio Verify). Seeded demo numbers accept a fixed test code, enabled only by env var.
- A11. Credit used = ledger outstanding + orders not yet exported to Tally (placed or confirmed). Orders already on hold are not counted. Over-limit orders are held for the desk, not rejected.
- A12. Stock is reserved when the order is placed (paid + free cases) and is not returned automatically if the desk cancels.
- A10. Tally export is a Tally Prime sales-voucher XML; the client's real ledger and item names are unknown.
