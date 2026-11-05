# RetailDesk: deployment and demo logins

- **GitHub:** https://github.com/Tarun9076/RetailDesk
- **Live app:** https://retaildesk-pied.vercel.app
  - Shop owners: `/login`
  - Salesmen: `/sales/login`
  - Order desk: `/desk/login`

Built by Tarun. No secrets are in the repository: `.env` is ignored by git, and this file lists variable **names** only.

---

## 1. Run it locally

You need **Node.js 20 or newer** and a free **Supabase** account (any Postgres works).

```bash
git clone https://github.com/Tarun9076/RetailDesk.git
cd RetailDesk
npm install            # also generates the Prisma client
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
```

Fill in `.env` (the names are in section 3). Then create the tables, add the demo data, and start:

```bash
npm run db:deploy      # applies the migrations in prisma/migrations
npm run db:seed        # demo data: 12 products, 7 shops, 18 salesmen, a desk user, ~105 orders
npm run dev            # http://localhost:3000
```

Useful extras:

```bash
npm test               # 226 unit tests (Vitest)
npm run lint
npm run build && npm start   # production build; the offline salesman mode and service worker only run in this mode
```

`npm run db:seed` can be run again at any time. It wipes and recreates the demo data.

## 2. How it is deployed

| Part | Where | Notes |
| --- | --- | --- |
| Web app and API | **Vercel** (Next.js 16) | Connected to the GitHub repo. Every push to `main` deploys. |
| Region | Vercel function region **Mumbai (`bom1`)**, set in `vercel.json` | Same region as the database. Measured round trip to the database from India is about 33 ms; from a US region it was 200+ ms per query. |
| Database | **Supabase Postgres** | The app connects through the **transaction pooler** (port 6543). Vercel cannot use the direct connection, which is IPv6 only. |
| Migrations and seed | Run **from a developer machine**, against the direct connection (port 5432) | `npm run db:deploy`, then `npm run db:seed`. They are not part of the Vercel build. |
| SMS | **Twilio** (Programmable Messaging) | A real SMS is sent for any number that is not a demo number. |
| AI | **Google Gemini** | Used only to read an order message into lines. |

Steps to repeat the deployment:

1. Create a Supabase project (choose the region nearest your users).
2. From a local checkout with the **direct** string in `DIRECT_URL`, run `npm run db:deploy` and `npm run db:seed`.
3. In Vercel, import the GitHub repo. The framework is detected as Next.js; the default build command (`next build`) is used.
4. Add the environment variables below in **Settings → Environment Variables** (Production). Set `DATABASE_URL` to the Supabase **pooler** string.
5. Redeploy. Vercel applies new variables only to new deployments.

## 3. Environment variables (names only)

| Name | Required | What it is for |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Connection the running app uses. On Vercel, the Supabase **transaction pooler** string (port 6543) |
| `DIRECT_URL` | Yes | Direct connection (port 5432) used by the Prisma CLI for migrations and by the seed |
| `SESSION_SECRET` | Yes | Signs login cookies and hashes one-time codes. 32 or more random characters |
| `SEED_DESK_PASSWORD` | To seed | Password given to the demo desk user when the seed runs. Not read by the running app |
| `GEMINI_API_KEY` | For AI order capture | Google Gemini key. Without it the app falls back to a simple built-in reader |
| `GEMINI_MODEL` | Optional | Primary model, default `gemini-flash-latest` |
| `GEMINI_FALLBACK_MODEL` | Optional | Tried in parallel if the first is busy, default `gemini-flash-lite-latest` |
| `SMS_PROVIDER` | Yes | `twilio` on the live site. `console` prints codes to the server log (refused in production) |
| `TWILIO_ACCOUNT_SID` | With Twilio | Twilio account id |
| `TWILIO_AUTH_TOKEN` | With Twilio | Twilio secret |
| `TWILIO_FROM` | With Twilio | The Twilio sending number, e.g. `+1...` |
| `OTP_TEST_NUMBERS` | Demo | Comma-separated fake numbers that accept one fixed code |
| `OTP_TEST_CODE` | Demo | The fixed six-digit code for those numbers |
| `TALLY_COMPANY` | Optional | Company name written into the Tally XML export. The desk's **Tally set-up** screen overrides it |
| `BALANCES_API_TOKEN` | Optional | 24+ random characters. Turns on the route a script uses to send Tally balances every night. Empty = off |
| `ALERT_WEBHOOK_URL` | Optional | Slack or Discord webhook address (https). The server posts a short message there when it fails. Empty = off |

## 3a. Running the live system

**Watching it.**
- **Errors:** the desk's **System** tab lists every server problem once, with a count. Press *Send a test error* once after deploying: it should appear there and, if `ALERT_WEBHOOK_URL` is set, in your chat channel.
- **Uptime:** point a free monitor (for example UptimeRobot, 5-minute checks) at `https://<your-app>/api/health`. It returns 200, or 503 when the database cannot be reached, and nothing else.

**Backups.** Do all three; none replaces another.
1. **Supabase's own backups** depend on the plan (Dashboard, *Database*, *Backups*). I did not check which plan this project is on.
2. **From the desk:** *System*, then *Download a backup now*. All business data, compressed, **without** password hashes. Do it weekly and keep the file somewhere private (it has customer phone numbers).
3. **From the command line:** `npm run db:backup` writes `backups/retaildesk-<date>.json.gz`, **with** the desk password hashes. Store it like a password. It is ignored by git.

**Restoring** (only ever into an empty database):
```bash
# 1. create an empty database, then give it the tables
DIRECT_URL=<the new database> npm run db:deploy
# 2. load the backup
RESTORE_DATABASE_URL=<the new database> npm run db:restore -- backups/retaildesk-<date>.json.gz
# 3. point DATABASE_URL and DIRECT_URL at it. If the backup came from the desk download (no hashes):
DESK_EMAIL=<email> DESK_NEW_PASSWORD='<a long password>' npm run desk:reset
```
The restore refuses a database that already has rows, and uses its own variable so it cannot touch the live database by accident. It was practised by restoring a real backup into a separate schema and comparing every row of every table with the live data.

**Locked out of the desk?** `DESK_EMAIL=<email> DESK_NEW_PASSWORD='<a long password>' npm run desk:reset` sets a password; the person is asked to choose their own at the next sign-in.

**Tally balances every night.** Set `BALANCES_API_TOKEN` on the server (and redeploy). On the office PC, set `RETAILDESK_URL` and `RETAILDESK_TOKEN` (the same value) and run `scripts/send-balances.ps1 -File <Tally CSV> -Apply`, for example from Windows Task Scheduler after the day's vouchers are entered. Without `-Apply` it only checks. The CSV is Tally's *Sundry Debtors* list exported with a ledger-name column and a closing-balance column.

## 4. Demo logins

The seeded phone numbers are fake, so no SMS can reach them. `OTP_TEST_NUMBERS` and `OTP_TEST_CODE` let them sign in with one fixed code. Real numbers always get a real SMS (the Twilio account is a trial one, so it can only text numbers verified in Twilio).

**Fixed code for every demo number:** `246810`

### Shop owners: `/login`

| Number | Shop | Good for trying |
| --- | --- | --- |
| 9000000001 | Gupta General Store | A custom biscuit price and plenty of credit. Has "chhota biscuit" already learned for *Order by message* |
| 9000000002 | Yadav Kirana | Almost at the credit limit, so a big order goes **on hold** |
| 9000000003 | Aslam Provision Store | Nothing learned, so ambiguous messages become questions |
| 9000000004 | Jain Super Mart | Custom prices on biscuit and detergent, the biggest credit limit |
| 9000000005 | Patel Kirana & General | No order in 19 days |
| 9000000006 | Soni Departmental Store | No order in 27 days |
| 9000000007 | Tiwari Provision Store | New shop that has never ordered |

### Salesmen: `/sales/login`

| Number | Salesman | Shops |
| --- | --- | --- |
| 9100000001 | Anil Sharma | Gupta, Yadav, Aslam |
| 9100000002 | Bhupendra Singh | Jain, Patel |
| 9100000003 | Chetan Rathore | Soni, Tiwari |
| 9100000004 to 9100000018 | The other fifteen salesmen | None yet (the desk assigns shops) |

To see offline mode, open **My shops** once with a connection, then turn on airplane mode and keep working. Orders are saved on the phone and sent when the signal returns.

### Order desk: `/desk/login`

- Email: `desk@retaildesk.demo`
- Password: `[FILL IN BEFORE SENDING: the value used for SEED_DESK_PASSWORD]`

## 5. Known limits of the live demo

- **Twilio trial:** real SMS only reaches numbers verified in the Twilio console. Reviewers should use the demo numbers above.
- **Free hosting:** the first request after a quiet period can take a second or two longer while the server wakes up.
- **Offline salesman mode** needs one online sign-in first, and works best when the app is installed to the home screen (use the **Download app** button).
- The demo data is invented. Resetting it is one command: `npm run db:seed`.
