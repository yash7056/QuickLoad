# SSG Logistics — Cargo Booking Platform

A two-sided cargo booking system: customers book trucks, drivers accept and
run them, and an AI pricing engine quotes fares from live distance and
weather data.

```
CargoProject/
├── ai-engine/        FastAPI service — distance, weather, ML fare pricing
├── backend/          Express + MongoDB + Socket.io API shared by both portals
├── customer-portal/  React app — book a ride, track it live, rate & invoice
└── driver-portal/    React app — see open jobs, accept, run the trip, earnings
```

## Design system

Both portals share one visual language (dark navy surfaces, glass cards,
`Space Grotesk` / `Inter` / `JetBrains Mono` type) but each gets its own
accent so the two apps are never confused at a glance:

| Portal           | Accent  | Login tagline                                   |
|-------------------|---------|--------------------------------------------------|
| Customer Portal   | Teal    | "Book a truck in seconds, watch it move, live."  |
| Driver Portal     | Amber   | "Open jobs near you, one tap to accept."         |

The login/register screen (`src/AuthPage.jsx` + `AuthPage.css`, identical in
both apps) is the shared signature element: a glowing diagonal panel that
slides and mirrors sides when you switch between Sign In and Create Account.

## Running everything locally

You'll need 4 terminals (or a process manager of your choice).

**1. AI pricing engine** (FastAPI, port 8000)
```bash
cd ai-engine
pip install -r requirements.txt   # fastapi, uvicorn, joblib, pandas, geopy, requests
uvicorn main:app --reload --port 8000
```

**2. Backend API** (Express, port 5000)
```bash
cd backend
npm install
cp .env.example .env   # then fill in your own MONGO_URI
npm start              # or: node server.js
```
⚠️ The original `.env` in this project had a live MongoDB password committed
in plain text. Rotate that database password and never commit `.env` —
it's now in `.gitignore`.

**3. Customer Portal** (Vite, port 5173)
```bash
cd customer-portal
npm install
npm run dev
```

**4. Driver Portal** (Vite, port 5174)
```bash
cd driver-portal
npm install
npm run dev
```

## The ride lifecycle

```
quote → searching → accepted → picked-up → in-transit → delivered
```

1. A customer enters pickup/drop-off/vehicle and taps **Get Fare Quote**
   (`POST /api/quote`) — the backend calls the AI engine for a live,
   weather- and traffic-aware price, then itemises it into a real fare
   breakdown (base fare, per-km distance charge, rain/peak-hour surcharges,
   subtotal, IGST @ 18%, total). Nothing is booked yet.
2. The customer reviews that breakdown and taps **Confirm & Find Driver**.
   Only then does the ride get created (`POST /api/rides`, which re-quotes
   so the fare can't go stale) and broadcast over Socket.io.
3. Every driver's "Open Jobs" feed shows rides with `status: searching`.
   The first driver to tap **Accept** locks it
   (`PATCH /api/rides/:id/accept`) — a second driver tapping the same job
   gets a friendly "already taken" message instead of a duplicate booking.
4. The driver walks the trip forward one step at a time (Confirm Pickup →
   Start Trip → Mark Delivered). Every change broadcasts instantly to the
   customer's live tracking timeline.
5. The moment a ride is marked **delivered**, the backend assigns it a
   sequential invoice number (`SSG/2026/000123`). The customer can then rate
   the trip and download a proper GST tax invoice PDF — company letterhead,
   invoice number/date, billed-to details, an itemised charges table, a
   subtotal/IGST/total breakdown, and the amount spelled out in words —
   not just a single price line. The driver sees the fare (GST-inclusive)
   added to their earnings total.

Company/GST details used on the invoice (name, address, GSTIN, PAN, tax
rate) live in one place — the `COMPANY` constant near the top of
`backend/server.js` — and are served to the frontend via `GET /api/company`
so the invoice renderer never hardcodes them.

## Known things worth doing before production

- Passwords are stored in plain text (`User.password`) — add `bcrypt`
  hashing before this goes anywhere near real users.
- There's no session/auth token; `user` just lives in React state. Add
  JWTs or sessions if you need persistent login or real security.
- The accept route prevents two drivers grabbing the same ride, but there's
  no broader rate limiting or abuse protection on the public endpoints yet.
