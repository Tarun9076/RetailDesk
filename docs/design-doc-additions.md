# Additions for the Technical Design Document

Paste these into your editable copy of the Word document. They cover the five production features added after the first draft. Section numbers match the draft.

---

## 1.1 Status table: add these rows

| Requirement | Status | Notes |
| --- | --- | --- |
| Edit and switch off a shop | Done | Credit limit, mobile number, area, Tally name and salesman can be changed; switching off signs the owner out at once and hides the shop from phones. |
| Desk staff accounts | Done | Add colleagues with a temporary password, reset a forgotten password, switch people off, change your own password. |

## 3. Data model: add these rows

| Table | What it holds |
| --- | --- |
| ShopEvent | History of a shop: who changed its details, credit limit, status or balance, and what changed. |
| StaffEvent | History of desk accounts: added, password reset or changed, switched off or on, backup downloaded. |
| ErrorLog | Server problems grouped by kind, with a count, the route, and a short redacted detail. |

Also: a shop now has an **active** flag, and a user has **mustChangePassword** and **sessionsValidFrom** (the moment before which logins no longer count).

## 4. Roles table, desk row: replace the "Can do" text

Order queue, order detail, confirm, release a hold, cancel (reason required), change a line's product, export, loading list, shops dashboard, sales dashboard, **catalogue (products, prices, stock, schemes), edit or switch off shops, add and assign salesmen, manage desk staff**. English only.

## 5.3 Login and sessions: add these bullets

- **Desk staff are added by a colleague**, not by self sign-up. The new account gets a 12-character temporary password, shown once and never stored in readable form. Until the person chooses their own, every other desk screen and API refuses that account.
- **Password rules:** 10 or more characters with letters and numbers (or 16 or more), not a common password, not the email, not the old password. Wrong guesses at the current password are limited to 5 in 15 minutes.
- **Signing people out at once:** an account can carry a time before which logins no longer count, exact to the millisecond. It is set when a password is changed or reset, when staff are switched off, and when a shop's number changes or the shop is switched off. A stolen cookie dies immediately; the person who made the change stays signed in. If everyone is locked out, a command-line reset sets a password.

## New section: 5.5 The desk keeps the system running

- **Shops:** edit details and credit limit, change the Tally name, reassign the salesman, or switch the shop off. Nothing is deleted, because past orders refer to shops. Two shops cannot share a mobile number or a Tally name.
- **Monitoring:** every server failure is stored once per kind with a count (emails, phone numbers, tokens and database addresses removed) and sent to a Slack or Discord address the first time it happens and when it comes back. A failure in the alerting never makes the original request worse. A health address answers 200 or 503 for an uptime monitor. [A52]
- **Backups:** the command line makes a full copy and can restore it into an empty database, which refuses anything else. [A53]

## 10. Testing: replace the numbers and add rows

- **Automated tests:** 287 unit tests in 20 files (including password rules, signing people out, error redaction and grouping, backup file handling).
- **Live checks, each against a production build and then cleaned up:**
  - shops: 38 checks (edit, phone change, switch off and on, refusals, history)
  - desk staff: 49 checks (temporary password, forced change, resets, switch off, rate limit, history)
- **Not done:** the Tally file has not been run against a real Tally; whether the database host keeps its own backups was not checked.

## 11. What was cut: remove these rows

- "Verify the Tally import with the client's real ledger names" stays, as a half-day trial with the client's Tally.
- Add: "Reading balances back from Tally (upload screen or nightly script) and a Tally names screen with a checklist: built once, taken out for now because the client does not need them yet; about 2 days to bring back."
- Add: "A second approver for credit releases and role levels inside the desk: about 1 day."

## 8. UI and design decisions: replace the table's first rows with these

| Constraint | What I did |
| --- | --- |
| Minimal and restrained | White, near-black ink and **one green**. Green marks only what you act on. The chosen filter is dark, not green. Amber and red only for a warning, always with words. No decoration that does no job. |
| Fast catalogue with large images | Two large pictures across on a phone, five on a laptop. Each product is **drawn as a pack** from its own name (carton, pouch, bottle, tub, soap) in a muted colour that belongs to its product line, so similar products are told apart by sight. This costs **no image download** and a new product looks right at once. The desk can add a photo address; it is shown large and falls back to the drawing. |
| Clear prices | **The price comes first**, directly under the picture, so prices line up across a row and compare at a glance. Then the name, then one line each for GST (always stated), the piece price, the scheme, and stock only when low or out. |
| Quick cart | Add becomes a quantity bar in place. One rounded cart bar floats at the bottom with the count and total. In the cart, **Place order** stays at the bottom of the screen under the thumb with the total on it. Notes are folded away. |
| Less at the top | The shop's name, the language switch and one menu (Download app, Sign out). |
| Clear type | The phone's own fonts, one scale (24 px titles, 20 px prices, 15 px names, 12 px detail), tabular figures so prices align. |

Checked at 320, 390 and 1280 px in English and Hindi with no sideways scrolling. A first load is about 210 KB compressed with no image downloads. [A54, A55, A56]

## 12. Assumptions: add

A48 to A56 are in `docs/scope.md`.
