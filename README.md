# RetailDesk

An ordering app for a food and home-care distributor and the small shops it supplies.

A shopkeeper opens the app on their phone, sees stock, **their own price** and the **current scheme**, and places an order in about a minute. The distributor's office gets clean orders instead of retyping WhatsApp messages.

> This is a take-home project built from a client brief. The client, shops and numbers are made up for the exercise. See [Assumptions](#assumptions).

---

## Contents

- [The problem](#the-problem)
- [What it does today](#what-it-does-today)
- [Project status](#project-status)
- [Tech stack](#tech-stack)
- [Run it locally](#run-it-locally)
- [Demo logins](#demo-logins)
- [Environment variables](#environment-variables)
- [Useful commands](#useful-commands)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Security notes](#security-notes)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Assumptions](#assumptions)

---

## The problem

The client is a distributor in Jabalpur that supplies about 1,800 kirana (neighbourhood) shops. Today orders arrive as notebook entries, WhatsApp texts, photos of handwritten lists and Hindi voice notes. Six people type them into Tally the next morning.

That causes three costs:

- **Wrong items or quantities.** About 5% of orders need a return or redelivery.
- **Typing work.** Six people spend their day re-entering orders.
- **Stock-outs found too late.** Shops order things that are already finished.

RetailDesk lets shops see the truth up front (stock, price, scheme, credit) and order straight into the system.

## What it does today

**For shopkeepers (retailers)**

- Sign in with their mobile number and a one-time code sent by SMS.
- Browse a clean catalogue with their own prices. Every price says clearly that **GST is extra**, and shows the GST rate.
- See stock at a glance: *In stock*, *Only 8 cases left*, or *Out of stock*.
- See schemes on each product, like "Buy 10 cases, get 1 free" or "3% off on 5+ cases".
- Add to cart and watch the price update live. The app nudges them: *"Add 4 more cases for 3% off"*.
- See their available credit. If an order goes over the limit, it is not rejected. It goes to the office for approval, and the shop is told so.
- Place the order, view past orders, and **repeat an old order in one tap**.
- Use everything in **English or Hindi**.

**For the office (order desk)**

- Sign in with email and password. The desk area is protected and only desk staff can enter it. The queue itself is not built yet (see below).

## Project status

| Area | Status |
| --- | --- |
| SMS OTP login for retailers | Done |
| Email and password login for the desk | Done |
| Catalogue with retailer prices, GST, stock, schemes | Done |
| Scheme engine (free goods and slab discounts) | Done, with tests |
| Cart, credit check, place order, order history, repeat order | Done |
| English and Hindi | Done |
| Order desk: queue, releasing credit holds | Next |
| Tally export | Next |
| AI order capture from a pasted message | Next |
| Retailers with no order in 14 days (dashboard) | Planned |
| Salesman mode, offline use, voice notes, photo of a list | Not in the core build |

## Tech stack

| Part | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 (App Router) and TypeScript | One codebase for pages and API, fast on slow phones |
| Styling | Tailwind CSS | Small, consistent, easy to keep minimal |
| Database | PostgreSQL on Supabase | Reliable, free to start, and plain Postgres underneath |
| ORM | Prisma 7 | Typed queries and tracked migrations |
| Login | Own implementation with `jose` (session tokens) and `argon2` (passwords) | Full control over OTP rules and rate limits |
| SMS | Twilio, behind a small interface | Swap in another provider without touching the rest |
| AI | Google Gemini | Reads messy order text (coming soon) |
| Validation | Zod | Every request body is checked |
| Tests | Vitest | Fast unit tests for the important logic |

## Run it locally

You need **Node.js 20 or newer** and a free **Supabase** account.

### 1. Get the code and install

```bash
git clone <your-repo-url>
cd RetailDesk
npm install
```

`npm install` also generates the Prisma client automatically.

### 2. Create a Supabase database

1. Create a project at [supabase.com](https://supabase.com) (pick a region near you).
2. Click **Connect** and copy the connection strings.
3. Remember the database password you set. If it has symbols like `@` or `/`, either URL-encode them or reset it to letters and numbers.

### 3. Add your settings

Copy the example file and fill it in:

```bash
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env`.

At minimum, set:

- `DATABASE_URL` and `DIRECT_URL` (your Supabase strings)
- `SESSION_SECRET` (any random string of 32+ characters)
- `SEED_DESK_PASSWORD` (the password you want for the demo desk login, 8+ characters)
- `OTP_TEST_NUMBERS` and `OTP_TEST_CODE` (so you can log in without a real SMS, see [Demo logins](#demo-logins))

Full list: [Environment variables](#environment-variables). Never commit `.env`. It is already in `.gitignore`.

### 4. Create the tables and add sample data

```bash
npm run db:deploy
npm run db:seed
```

The seed adds 12 products, 6 shops, a desk user and about 45 past orders. You can run it again any time to reset the demo data.

### 5. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo logins

**Retailer** (opens the catalogue)

1. Go to `/login`.
2. Enter any seeded number, `9000000001` to `9000000006`.
3. Enter the code you set in `OTP_TEST_CODE`.

Those six numbers are fake, so no SMS can reach them. That is why `OTP_TEST_NUMBERS` and `OTP_TEST_CODE` exist. They are a **demo-only shortcut** that accepts one fixed code for the listed numbers. Real numbers always get a real SMS, and the shortcut stays off unless you set both variables.

| Number | Shop | Good for trying |
| --- | --- | --- |
| 9000000001 | Gupta General Store | A custom biscuit price, plenty of credit |
| 9000000002 | Yadav Kirana | Almost at the credit limit, so a big order goes on hold |
| 9000000004 | Jain Super Mart | Custom prices on biscuit and detergent, the biggest credit limit |
| 9000000005 | Patel Kirana & General | No order in 19 days |
| 9000000006 | Soni Departmental Store | No order in 27 days |

**Order desk**

- Go to `/desk/login`.
- Email: `desk@retaildesk.demo`
- Password: whatever you set as `SEED_DESK_PASSWORD`.

## Environment variables

Names only. Put your values in `.env`.

| Name | Needed | What it is for |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Database connection the running app uses |
| `DIRECT_URL` | Yes | Direct connection used for migrations |
| `SESSION_SECRET` | Yes | Signs login cookies. 32+ random characters |
| `SEED_DESK_PASSWORD` | For seeding | Password of the demo desk user |
| `OTP_TEST_NUMBERS` | Demo only | Comma-separated fake numbers that accept the test code |
| `OTP_TEST_CODE` | Demo only | The fixed 6-digit code for those numbers |
| `SMS_PROVIDER` | Yes | `console` (prints codes locally) or `twilio` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | With Twilio | Real SMS sending |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | For AI capture | Google Gemini access (feature coming) |

`SMS_PROVIDER=console` is blocked in production on purpose, so one-time codes are never written to a live server's logs.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app in development |
| `npm run build` | Make a production build |
| `npm start` | Run the production build |
| `npm test` | Run all tests once |
| `npm run test:watch` | Re-run tests as you edit |
| `npm run lint` | Check code style |
| `npm run db:deploy` | Apply database migrations (safe, non-interactive) |
| `npm run db:migrate` | Create a new migration while developing a schema change |
| `npm run db:seed` | Wipe and refill the demo data |
| `npm run db:generate` | Re-create the Prisma client |

## How it works

### Money is whole numbers

All amounts are stored in **paise** (₹1 = 100 paise) as integers. That avoids rounding errors you get with decimals. Prices in the data are **per piece**, and shops order in **whole cases**.

### The scheme engine

The trickiest part of the brief, kept as plain, well-tested code in `src/lib/pricing/engine.ts`.

- **Free goods:** "buy 10, get 1 free" gives `floor(cases / 10)` free cases. 10 cases earns 1, 20 earns 2, 19 earns 1.
- **Slab discount:** "3% off on 5+ cases" applies to the whole line once the quantity reaches 5.
- **GST** is added on what the shop pays, after the discount. Free cases carry no GST.
- **Stock counts free cases too.** With 340 cases in stock, the most a shop can order with a buy-10-get-1 scheme is 309 (309 + 30 free = 339).
- Expired or inactive schemes are ignored.

The browser uses this engine to show a live preview. When you place the order, **the server recalculates everything** from the database, so the numbers sent by the browser are never trusted.

### Placing an order safely

- **Stock is reserved in one step.** Two shops cannot both take the last cases.
- **Double taps are harmless.** Each order carries a one-time key. Sending it twice returns the same order instead of creating two.
- **Credit check.** Credit used is the account balance plus orders not yet billed. Over the limit means the order goes **on hold** for the office. It is not refused.

### Login

- **Retailers:** a 6-digit code by SMS. Codes are stored only as a hash, expire in 5 minutes, work once and lock after 5 wrong tries. There are limits on how often codes can be requested. An unknown number gets the same reply as a known one, so nobody can use the form to find out who is a customer.
- **Desk staff:** email and password (hashed with argon2), with limits on failed attempts.
- **Sessions** are signed, HTTP-only cookies. Retailers stay signed in for 30 days and desk staff for 12 hours.
- Every protected page re-checks the user in the database, not just the cookie.

### Who can see what

A shop only ever sees its own prices, credit and orders. Queries are filtered by the signed-in retailer on the server. The retailer id is taken from the session, never from the request.

## Project structure

```text
prisma/
  schema.prisma        Database tables
  migrations/          Migration history
  seed.ts              Demo data
src/
  app/
    login/             Retailer sign-in
    desk/              Desk sign-in and desk area
    (retailer)/        Catalogue, cart, orders (signed-in shops only)
    api/               Auth and order endpoints
  components/          UI building blocks
    retailer/          Product card, cart, stepper, and so on
  lib/
    pricing/           Scheme engine (the core logic)
    orders/            Order building, credit check, placing orders
    auth/              OTP, sessions, rate limits, SMS sender
    i18n/              English and Hindi text
docs/
  scope.md             What is in, what is cut, and every assumption
```

## Security notes

- No secrets are in the repository. Settings come from environment variables, and `.env` is git-ignored.
- All request bodies are validated with Zod.
- Cookie-based POST requests are checked against the site's own origin to block cross-site requests.
- Passwords and one-time codes are hashed. Login and OTP endpoints are rate limited.
- Access control happens on the server, on every request.
- The demo OTP shortcut only works for the numbers you list, and only when you turn it on.

## Testing

```bash
npm test
```

Covers the logic where mistakes would cost money or trust:

- The scheme engine: thresholds, rounding, GST, stock and scheme dates.
- Order building: merging duplicate lines, stock limits, unknown products.
- The credit check, including the exact-limit case.
- Login: phone number cleanup, one-time code rules, and session tampering.

## Troubleshooting

**"Unknown argument" or a Prisma error after changing the schema.**
Run `npm run db:generate`, then stop and restart `npm run dev`. A running dev server keeps the old database client in memory.

**Cannot connect to the Supabase direct host.**
The free plan's direct host can be IPv6 only. Use the **session pooler** string (port 5432) for `DIRECT_URL`.

**Login says too many attempts.**
That is the rate limiter working. Wait for the time shown, or run `npm run db:seed`, which clears it.

**`npm run db:migrate` refuses to run.**
It needs an interactive terminal. Use `npm run db:deploy` to apply existing migrations.

## Assumptions

The brief leaves gaps, and I filled them with clearly labelled assumptions. They live in [`docs/scope.md`](docs/scope.md). The important ones:

- Prices in the sample data are per piece, and orders are in whole cases.
- GST is not in the brief. I assumed 12% or 18% by product, and show prices excluding GST.
- Each product has at most one active scheme. A slab applies to the whole line.
- Over-limit orders are held for the desk, not rejected.
- Shops, balances, credit limits and orders are invented demo data.
