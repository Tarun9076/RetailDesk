# Additions for the Technical Design Document

Paste these into your editable copy of the Word document. They cover the five production features added after the first draft. Section numbers match the draft.

---

## 1.1 Status table: add these rows

| Requirement | Status | Notes |
| --- | --- | --- |
| Edit and switch off a shop | Done | Credit limit, mobile number, area, Tally name and salesman can be changed; switching off signs the owner out at once and hides the shop from phones. |
| Desk staff accounts | Done | Add colleagues with a temporary password, reset a forgotten password, switch people off, change your own password. |
| Balances from Tally | Done | Upload an export (Excel or CSV) with a preview before anything is saved, or send it from a script. Not yet run against a real Tally export. |
| Tally set-up | Done | Ledger names are settings, with a checklist of every ledger and stock item Tally needs. The first import into a real Tally is still to be done. |
| Monitoring and backups | Done | Error log, alerts, health check, downloadable backup and a restore that was checked row for row. |

## 3. Data model: add these rows

| Table | What it holds |
| --- | --- |
| ShopEvent | History of a shop: who changed its details, credit limit, status or balance, and what changed. |
| StaffEvent | History of desk accounts: added, password reset or changed, switched off or on, backup downloaded. |
| BalanceImport | One run of the Tally balance update: who, from what file or script, the rows previewed, and the result. |
| TallySetting | The names the Tally file uses (company, ledgers, unit, voucher type), editable by the desk. |
| ErrorLog | Server problems grouped by kind, with a count, the route, and a short redacted detail. |

Also: a shop now has an **active** flag, and a user has **mustChangePassword** and **sessionsValidFrom** (the moment before which logins no longer count).

## 4. Roles table, desk row: replace the "Can do" text

Order queue, order detail, confirm, release a hold, cancel (reason required), change a line's product, export, loading list, shops dashboard, sales dashboard, **catalogue (products, prices, stock, schemes), edit or switch off shops, add and assign salesmen, upload balances from Tally, set the Tally names, manage desk staff, see the system health and download a backup**. English only.

## 5.3 Login and sessions: add these bullets

- **Desk staff are added by a colleague**, not by self sign-up. The new account gets a 12-character temporary password, shown once and never stored in readable form. Until the person chooses their own, every other desk screen and API refuses that account.
- **Password rules:** 10 or more characters with letters and numbers (or 16 or more), not a common password, not the email, not the old password. Wrong guesses at the current password are limited to 5 in 15 minutes.
- **Signing people out at once:** an account can carry a time before which logins no longer count, exact to the millisecond. It is set when a password is changed or reset, when staff are switched off, and when a shop's number changes or the shop is switched off. A stolen cookie dies immediately; the person who made the change stays signed in. If everyone is locked out, a command-line reset sets a password.

## New section: 5.5 The desk keeps the system running

- **Shops:** edit details and credit limit, change the Tally name, reassign the salesman, or switch the shop off. Nothing is deleted, because past orders refer to shops. Two shops cannot share a mobile number or a Tally name.
- **Balances from Tally:** a shop's credit is checked against what it owes in Tally, so that number must stay current. The desk uploads Tally's Sundry Debtors list, or a script on the office PC sends it. Column names are found by what they are called, so Tally's different report layouts all work (a Closing Balance with Dr and Cr, separate Debit and Credit columns, or bill-by-bill pending amounts that are added up). Amounts are read exactly, in whole paise. A shop is matched by its Tally name; a name that fits no shop or two shops is listed and skipped, never guessed. Tally "Cr" (the shop is in credit) is stored as zero. Nothing is saved until the desk reviews the preview and presses Save, and a shop that changed after the preview is skipped rather than overwritten. [A50]
- **Tally set-up:** the company, sales ledger, GST ledgers, unit and voucher type are settings. A checklist lists every ledger, stock item and unit that must exist in Tally before the file imports. [A51]
- **Monitoring:** every server failure is stored once per kind with a count (emails, phone numbers, tokens and database addresses removed), shown on the System screen, and sent to a Slack or Discord address the first time it happens and when it comes back. A failure in the alerting never makes the original request worse. A health address answers 200 or 503 for an uptime monitor. [A52]
- **Backups:** the desk downloads all business data (no password hashes); the command line makes a full copy and can restore it into an empty database, which refuses anything else. [A53]

## 10. Testing: replace the numbers and add rows

- **Automated tests:** 302 unit tests in 21 files (add: password rules, signing people out, Tally balance reading and matching, Tally names and checklist, error redaction and grouping, backup file handling).
- **Live checks, each against a production build and then cleaned up:**
  - shops: 38 checks (edit, phone change, switch off and on, refusals, history)
  - desk staff: 49 checks (temporary password, forced change, resets, switch off, rate limit, history)
  - Tally balances: 48 checks (upload, preview, apply, stale protection, Excel, the automatic route)
  - Tally names and export: 28 checks (settings, checklist file, a real order exported with the saved names and balanced to the paisa)
  - monitoring: 27 checks (health, an error reaching chat and the log, repeats, resolve, chat down), plus a run with an unreachable database that answered 503
  - backup: 14 checks, plus a restore into a separate schema that matched **every row** of every table
- **Not done:** the Tally file and the balance export have not been run against a real Tally; whether the database host keeps its own backups was not checked.

## 11. What was cut: remove these rows

- "Verify the Tally import with the client's real ledger names" stays, but change the note to: "Ledger names are now settings and a checklist exists, so this is a half-day trial with the client's Tally."
- Add: "Getting Tally to write the balance CSV by itself every night: about half a day, done on the client's side with Tally's scheduling or an ODBC export." 
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
