# Witness-Node — Command Center (Dashboard)

Next.js 15 dashboard. Polls the backend every 3s and renders the live incident feed.

## Run

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:3000.

The dashboard falls back to **mock data** if the backend is unreachable, so you can build UI without the backend running. A pill in the header shows which mode you're in (live vs mock).

## Config

Set the backend URL in `.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For production, point this at your Vultr URL.

## API contract

Types live in `lib/types.ts`. They mirror `backend/app/models.py::IncidentSummary` — keep them in sync when the backend contract changes.
