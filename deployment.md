# RetailDesk: deployment guide

| | |
| --- | --- |
| **GitHub** | https://github.com/Tarun9076/RetailDesk |
| **Live app** | https://retaildesk-pied.vercel.app |
| **Shop owners** | `/login` |
| **Salesmen** | `/sales/login` |
| **Order desk** | `/desk/login` |

Built by Tarun. No secrets are in the repository: `.env` is ignored by git, and this file lists variable **names** only.

**What this file covers**

1. [How to run it locally](#1-how-to-run-it-locally)
2. [How it is deployed](#2-how-it-is-deployed)
3. [Environment variables (names only)](#3-environment-variables-names-only)
4. [Demo login details for the reviewer](#4-demo-login-details-for-the-reviewer)
5. [What to try first](#5-what-to-try-first)
6. [Running the live system](#6-running-the-live-system)
7. [Known limits](#7-known-limits)
8. [If something does not work](#8-if-something-does-not-work)

---

## 1. How to run it locally

### What you need

- **Node.js 20 or newer** and **npm**
- **Git**
- A **Postgres database**. A free [Supabase](https://supabase.com) project is the easiest (any Postgres works)

### Steps

**Step 1. Get the code and install.**

```bash
git clone https://github.com/Tarun9076/RetailDesk.git
cd RetailDesk
npm install            # also generates the Prisma client
```

**Step 2. Create your settings file.**

```bash
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
```

**Step 3. Fill in `.env`.** For a local run you need these (what each one is for is in [section 3](#3-environment-variables-names-only)):

```
DATABASE_URL=            # your Postgres connection string
DIRECT_URL=              # the direct (non-pooled) connection string; the same value is fine locally
SESSION_SECRET=          # 32 or more random characters
SEED_DESK_PASSWORD=      # any password of 8+ characters, for the demo desk user

# So the demo numbers can sign in without real SMS:
SMS_PROVIDER=console
OTP_TEST_NUMBERS=+919000000001,+919000000002,+919000000003,+919000000004,+919000000005,+919000000006,+919000000007,+919100000001
OTP_TEST_CODE=246810

# Optional, for AI order capture (typed messages and photos of a list):
GEMINI_API_KEY=
```

**Step 4. Create the tables and the demo data.**

```bash
npm run db:deploy      # applies the migrations in prisma/migrations
npm run db:seed        # demo data: 12 products, 7 shops, 18 salesmen, a desk user, about 105 orders
```

**Step 5. Start the app.**

```bash
npm run dev            # open http://localhost:3000
```

**Step 6. Sign in** with the demo logins in [section 4](#4-demo-login-details-for-the-reviewer). For the desk, use `desk@retaildesk.demo` and the `SEED_DESK_PASSWORD` you chose in step 3.

### Checks and the production build

```bash
npm test                     # 301 unit tests in 22 files (Vitest)
npx tsc --noEmit             # type check
npm run lint
npm run build && npm start   # production build, http://localhost:3000
```

Use the production build to try **offline salesman mode** and the installable app: the service worker only runs there, not in `npm run dev`.

### Good to know

- `npm run db:seed` can be run again at any time. It **wipes and recreates the demo data**, including any orders you made. It links the product photos in `public/products` again.
- Without `GEMINI_API_KEY`, *Order by message* still works with a simpler built-in reader, but **photo of a list** needs the key.
- With `SMS_PROVIDER=console`, a code for a number that is not in `OTP_TEST_NUMBERS` is printed in the terminal running the app. This mode is refused in production.

---

## 2. How it is deployed

### Where each part runs

| Part | Where | Notes |
| --- | --- | --- |
| Web app and API | **Vercel** (Next.js 16) | Connected to the GitHub repo. Every push to `main` deploys. |
| Region | Vercel function region **Mumbai (`bom1`)**, set in `vercel.json` | Same region as the database. Measured round trip to the database from India is about 33 ms; from a US region it was 200+ ms per query. |
| Database | **Supabase Postgres** | The app connects through the **transaction pooler** (port 6543). Vercel cannot use the direct connection, which is IPv6 only. |
| Migrations and seed | Run **from a developer machine**, against the direct connection (port 5432) | `npm run db:deploy`, then `npm run db:seed`. They are not part of the Vercel build. |
| Product photos | **Static files in the repo** (`public/products`) | Served by Vercel's network and cached for a year. |
| SMS | **Twilio** (Programmable Messaging) | A real SMS is sent for any number that is not a demo number. |
| AI | **Google Gemini** | Reads an order message or a photo of a list into lines. Pictures are not stored. |

### Steps to repeat the deployment

1. **Create a Supabase project** in the region nearest your users.
2. **Create the tables and demo data.** From a local checkout with the **direct** connection string in `DIRECT_URL`, run `npm run db:deploy`, then `npm run db:seed`.
3. **Import the repo in Vercel.** The framework is detected as Next.js and the default build command (`next build`) is used. No other build settings are needed.
4. **Add the environment variables** from [section 3](#3-environment-variables-names-only) in *Settings → Environment Variables* (Production). Set `DATABASE_URL` to the Supabase **pooler** string.
5. **Redeploy.** Vercel applies new variables only to new deployments.
6. **Check it.** Open `https://<your-app>/api/health`. It should answer `{"status":"ok","database":"ok",...}`.

### Releasing a change

Commit and push to `main`. If the change touches the database, run `npm run db:deploy` from your machine **before** the push, so the new code never runs against old tables.

### Product photos

The catalogue shows a drawn pack for every product until it has a photo. Photos are resized to 480 px WebP files of about 10 KB so the catalogue stays fast on 3G.

1. Put one photo per product in a `product-photos/` folder (not committed), named by product code, for example `product-photos/SKU-BS-075.jpg`.
2. Run `npm run photos -- --dry` to preview, then `npm run photos`. This writes small files to `public/products/` and links them to the products.
3. Commit `public/products/` and push, so Vercel serves them.

Eleven of the twelve products have a photo. *Detergent powder 500 g* shows its drawn pack.

---

## 3. Environment variables (names only)

Never commit values. Locally they go in `.env`; on Vercel in *Settings → Environment Variables*.

### The running app

| Name | Required | What it is for |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Connection the running app uses. On Vercel, the Supabase **transaction pooler** string (port 6543) |
| `DIRECT_URL` | Yes (local) | Direct connection (port 5432) used by the Prisma CLI for migrations and by the seed |
| `SESSION_SECRET` | Yes | Signs login cookies and hashes one-time codes. 32 or more random characters |
| `SMS_PROVIDER` | Yes | `twilio` on the live site. `console` prints codes to the server log (refused in production) |
| `TWILIO_ACCOUNT_SID` | With Twilio | Twilio account id |
| `TWILIO_AUTH_TOKEN` | With Twilio | Twilio secret |
| `TWILIO_FROM` | With Twilio | The Twilio sending number, e.g. `+1...` |
| `OTP_TEST_NUMBERS` | Demo | Comma-separated fake numbers that accept one fixed code |
| `OTP_TEST_CODE` | Demo | The fixed six-digit code for those numbers |
| `GEMINI_API_KEY` | For AI capture | Google Gemini key. Without it, typed messages use a simple built-in reader and **photo capture is unavailable** |
| `GEMINI_MODEL` | Optional | Primary model, default `gemini-flash-latest` |
| `GEMINI_FALLBACK_MODEL` | Optional | Tried in parallel if the first is busy, default `gemini-flash-lite-latest` |
| `TALLY_COMPANY` | Optional | Company name written into the Tally XML export. Default: a placeholder |
| `ALERT_WEBHOOK_URL` | Optional | Slack or Discord webhook address (https). The server posts a short message there when it fails. Empty = off |

### Only for command-line scripts (not needed on Vercel)

| Name | Used by | What it is for |
| --- | --- | --- |
| `SEED_DESK_PASSWORD` | `npm run db:seed` | Password given to the demo desk user (8+ characters). Not read by the running app |
| `DESK_EMAIL`, `DESK_NEW_PASSWORD` | `npm run desk:reset` | Which desk account to reset, and its new temporary password |
| `BACKUP_DIR` | `npm run db:backup` | Where the backup file is written (default `backups/`) |
| `RESTORE_DATABASE_URL` | `npm run db:restore` | The **empty** database to restore into. Separate on purpose, so it cannot touch the live database |
| `RESTORE_SCHEMA` | `npm run db:restore` | Optional: restore into a separate schema to practise |

---

## 4. Demo login details for the reviewer

The seeded phone numbers are fake, so no SMS can reach them. They sign in with one fixed code. Real numbers always get a real SMS, but the Twilio account is a trial one and can only text numbers verified in Twilio, so please use the demo numbers.

### Quick start

| Role | Where | Login | Code or password |
| --- | --- | --- | --- |
| **Shop owner** | `/login` | `9000000001` | OTP `246810` |
| **Salesman** | `/sales/login` | `9100000001` | OTP `246810` |
| **Order desk (admin)** | `/desk/login` | `desk@retaildesk.demo` | Shared with the reviewer separately (not stored in this repository) |

### All demo shop owners (`/login`, OTP `246810` for every number)

| Number | Shop | Good for trying |
| --- | --- | --- |
| 9000000001 | Gupta General Store | A custom biscuit price and plenty of credit. Has "chhota biscuit" already learned for *Order by message* |
| 9000000002 | Yadav Kirana | Almost at the credit limit, so a big order goes **on hold** |
| 9000000003 | Aslam Provision Store | Nothing learned, so ambiguous messages become questions |
| 9000000004 | Jain Super Mart | Custom prices on biscuit and detergent, the biggest credit limit |
| 9000000005 | Patel Kirana & General | No order in 19 days |
| 9000000006 | Soni Departmental Store | No order in 27 days |
| 9000000007 | Tiwari Provision Store | New shop that has never ordered |

### All demo salesmen (`/sales/login`, OTP `246810` for every number)

| Number | Salesman | Shops |
| --- | --- | --- |
| 9100000001 | Anil Sharma | Gupta, Yadav, Aslam |
| 9100000002 | Bhupendra Singh | Jain, Patel |
| 9100000003 | Chetan Rathore | Soni, Tiwari |
| 9100000004 to 9100000018 | The other fifteen salesmen | None yet (the desk assigns shops) |

The desk is English only. The shop and salesman apps have an English / Hindi switch.

---

## 5. What to try first

The demo data is invented, except the three products, prices, stock and schemes that came from the client's brief.

1. **Order as a shop** (`9000000001`). In the catalogue: large product pictures, the price first, GST always stated, the scheme under the product, stock only when low. Add 10 cases of *Glucose biscuit 75 g* and see the free case appear (**buy 10, get 1 free**). Add 5 or more *Detergent powder 1 kg* to see **3% off**. *Tea leaf 250 g* is out of stock (0 cases, as in the brief).
2. **Order by message.** On the *Order by message* tab, press the example `bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti`, or use **Photo of your list** with a photo or screenshot of a list. Each line shows the original words, a confidence level and alternatives. Nothing is ordered until you confirm.
3. **Credit hold.** Sign in as `9000000002` (Yadav Kirana, almost at the credit limit) and place a larger order. It goes **on hold** instead of being rejected.
4. **Order desk.** Open the queue, release the held order, confirm orders, then try **Export** (Excel sales register or Tally XML), the **Loading list** (what to load on each van), **Dashboard**, and **Shops** (shops with no order in 14 days). **Catalogue** edits products, prices, stock and schemes.
5. **Salesman offline** (`9100000001`). Open *My shops* once while online, switch the phone to airplane mode, and keep taking orders. They send themselves when the signal returns. Offline mode works best when the app is installed to the home screen (the **Download app** button).

---

## 6. Running the live system

**Watching it**
- **Errors:** every server problem is stored once per kind with a count (in the `ErrorLog` table) and, if `ALERT_WEBHOOK_URL` is set, sent to your chat channel. Vercel's own logs also show them. A page that breaks shows the user a short message with a reference number that matches the log.
- **Uptime:** point a free monitor (for example UptimeRobot, 5-minute checks) at `https://<your-app>/api/health`. It returns 200, or 503 when the database cannot be reached, and nothing else.

**Backups.** Do both; neither replaces the other.
1. **Supabase's own backups** depend on the plan (Dashboard, *Database*, *Backups*). I did not check which plan this project is on.
2. **From the command line:** `npm run db:backup` writes `backups/retaildesk-<date>.json.gz`, **with** the desk password hashes. Store it like a password. It is ignored by git.

**Restoring** (only ever into an empty database):

```bash
# 1. create an empty database, then give it the tables
DIRECT_URL=<the new database> npm run db:deploy
# 2. load the backup
RESTORE_DATABASE_URL=<the new database> npm run db:restore -- backups/retaildesk-<date>.json.gz
# 3. point DATABASE_URL and DIRECT_URL at it
```

The restore refuses a database that already has rows. It was practised by restoring a real backup into a separate schema and comparing every row of every table with the live data.

**Locked out of the desk?** `DESK_EMAIL=<email> DESK_NEW_PASSWORD='<a long password>' npm run desk:reset` sets a password; the person is asked to choose their own at the next sign-in. On Windows PowerShell, set the two variables with `$env:NAME = "value"` first, then run the command.

---

## 7. Known limits

Honest notes on what is not done or not proven:

- **Tally has not been tried for real.** The Tally XML and the Excel register are tested to balance to the paisa, but the XML has never been imported into a real Tally. Ledger names are defaults (`TALLY_COMPANY` sets the company); the client would confirm the real names at a first trial import.
- **Balances do not come from Tally.** A shop's "amount owed" is set by the desk and raised by exported orders, so credit holds are only as current as that figure. Reading balances back from Tally was built and then taken out for now.
- **Photo of a list** was tested with real handwritten lists as well as generated images (printed and handwriting-style fonts, English and Hindi), and worked as expected. Handwriting is still easy to misread, so the screen says "check every line". If the AI is unavailable, a photo cannot be read and the shopkeeper is asked to type the list.
- **Hindi voice notes are not built.** Typed and photographed lists are.
- **Twilio trial:** real SMS only reaches numbers verified in the Twilio console. Reviewers should use the demo numbers.
- **Free hosting:** the first request after a quiet period can take a second or two longer while the server wakes up.
- **Offline salesman mode** needs one online sign-in first.
- **No automated browser tests or CI.** The 301 unit tests cover the logic (schemes, pricing, matching, sign-in, sessions, Tally files, sync). Screens were checked by hand and by scripts against a production build.
- **Hindi text** has not been reviewed by a native speaker.
- **Security notes:** inputs are validated, every route checks the role, sign-in codes are hashed and rate limited, and security headers are set. There is no full page-level content security policy yet, and `npm audit` reports two moderate advisories in a dependency of the Excel library, which only runs for signed-in desk users.
- **Backups:** Supabase's own backups depend on the plan, which I did not check; the command-line backup is the one I tested.
- The demo data is invented. Resetting it is one command: `npm run db:seed`.

---

## 8. If something does not work

| What you see | Likely cause and fix |
| --- | --- |
| The app says the Prisma client is missing | Run `npm run db:generate` |
| `Can't reach database server` | Check `DATABASE_URL` and `DIRECT_URL`. Locally use the direct string (5432); on Vercel the pooler (6543) |
| `Set SEED_DESK_PASSWORD (8+ characters)` | Add it to `.env` before `npm run db:seed` |
| No code arrives | Use a demo number with `246810`. For other numbers `SMS_PROVIDER` must be `twilio` and the number verified in the trial account |
| `SMS_PROVIDER=console` refused | That mode is blocked when `NODE_ENV=production`. Use `npm run dev` locally |
| *Order by message* says it used a simpler method | `GEMINI_API_KEY` is missing, the model is busy, or the quota is used up |
| Photo of a list says it could not be read right now | The same causes, or a slow connection. Typing the list always works |
| Products show drawings, not photos | The photo is not committed or not linked: see [Product photos](#product-photos) |
| Offline mode does nothing | Use the production build (`npm run build && npm start`) or the live site; the service worker does not run in `npm run dev` |
| `/api/health` returns 503 | The database cannot be reached. Check Supabase and `DATABASE_URL` |
