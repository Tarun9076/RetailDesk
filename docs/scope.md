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
- A13. When the desk exports an order to Tally, the shop's account balance goes up by the order total. Tally is the real ledger, so this mirrors what it will show after import, and keeps "credit used" correct once the order leaves the queue.
- A14. The Tally file assumes intra-state sales (Jabalpur shops): GST is booked as half CGST and half SGST, per rate. Free goods are zero-value stock lines. Ledger names (Sales, Output CGST @6%, ...) and the stock unit "Case" are placeholders the client must confirm.
- A15. The desk can release a credit hold on its own judgement. There is no second approver, but every release records who did it and when. Exported and cancelled orders are final.
- A16. The desk screens are English only. The language switch is for shopkeepers.
- A17. AI capture reads text only. Voice notes and photos of a handwritten list use the same pipeline (they would first be turned into text) but are not built. The AI never picks products: it only reads the message into lines, and the app's own matcher chooses and scores products.
- A18. The shop is only ever shown cases. If a message says pieces, the quantity is converted to whole cases and rounded up, and the shopkeeper sees that. A missing quantity or unit is asked, never assumed.
- A19. Matching uses only that shop's own past orders and learned phrases. What one shop teaches the app never affects another shop.
- A20. A correction is remembered when the shopkeeper (or desk) changes a guess, or picks on a line the app was unsure about. A swap away from an out-of-stock product is treated as a substitution and is not remembered.
- A21. The desk can change a line's product on an order that is still being checked (to check or on hold). The order is priced again and the credit check re-run. Confirmed, exported and cancelled orders cannot be changed.
- A22. Confidence is shown as three words (sure, please check, not sure), not a percentage, because the number is not a calibrated probability.
- A23. "No order in 14 days" is counted in Indian calendar days since the shop's latest order that was not cancelled. Exactly 14 days counts as quiet. Shops that have never ordered are listed separately, at the end.
- A24. The WhatsApp button only opens a pre-written message in WhatsApp on the desk user's own device. Nothing is sent by the app, because messaging is mocked for this build.
- A25. No web fonts: the app uses each phone's own system fonts (Roboto/Noto on Android, San Francisco on iPhone, Segoe UI/Nirmala on Windows). Measured on a production build, Noto Sans added about 300 KB to every first load.
- A26. Offline use is limited to a friendly offline page and cached static files. Prices, credit and orders are never cached on the phone. Salesman offline ordering with sync is not built.
- A27. "Sales" on the dashboard means orders the desk has confirmed or exported, by order date in Indian time, after scheme discounts and before GST. Orders to check or on hold are shown as "waiting", and cancelled orders count for nothing. The comparison is with the same number of days just before.
- A28. The Excel sales register is the main export. It is a register for the accounts team to read and enter or reconcile, not a Tally import: Tally Prime imports reliably from XML, which stays available as a secondary option. Both use the same GST split (half CGST, half SGST per rate).
- A29. The dashboard's AI share counts every order placed in the period that was not cancelled, so a message order counts as soon as it is placed. Every order here is placed in the app, so the client's "50% in the app or by AI" goal is tracked by the AI share, the stricter half.
- A30. "Download app" installs the web app from the browser (no app store). It uses the browser's own install dialog where one is offered, and shows step-by-step instructions where it is not (for example on iPhone).
- A31. Charts use a brighter green than the brand green because the brand green failed the colour validator's chroma check for data marks. The app is light only, so charts have no dark mode.
- A10. Tally export is a Tally Prime sales-voucher XML; the client's real ledger and item names are unknown.
