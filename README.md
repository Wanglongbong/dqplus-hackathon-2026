# VietNexus — curated deal flow, verified offline

VietNexus helps investors find a small set of relevant Vietnam startups, evaluate the opportunity before seeing the identity, then verify the people and product in a hosted Coffee & Chat. The public experience requires no login; identity-aware actions and private session data remain behind JWT authentication and server-side ownership checks.

## Core journey

1. Anyone can browse Community Pulse, Startup Constellation, and anonymized Blind Deal Room profiles.
2. AI ranks 12 opportunities against an investor thesis; the investor chooses exactly 5.
3. The investor proposes exactly 3 future 90-minute slots. Invited startups accept and vote.
4. When at least 3 startups accept, the system selects the most-voted slot and opens PayOS checkout for **1,490,000 VND**.
5. VietNexus suggests three Hanoi venues; a host confirms the location and checks attendees in.
6. The public profile records only a “met offline” count/date. Detailed post-meeting feedback stays private.

Startup participation is free. The fee covers curation and coordination, not drinks, due diligence, an investment recommendation, or any guarantee that a company is legitimate. Native mobile remains a design prototype using mock data. `ai-data-platform/` is the research/provenance pipeline and admin reference implementation; the public web client never talks directly to an agent service.

## Architecture

```text
Browser → Gateway (JWT + ownership) → PostgreSQL
                  ├→ Extract service (private service token)
                  ├→ Matching service (private service token)
                  ├→ PayOS (signed checkout + verified webhook)
                  └→ Source refresh worker (official public sources only)

ai-data-platform/ → sourced research, agent orchestration, verification and cost ledger
```

The gateway is the only public API. `GET /public/*` serves a strict anonymized projection that cannot include company identity, owner IDs, source domains, or direct contacts. Startup identity opens after invitation acceptance; contacts open only after payment/session confirmation. Matching and extraction bind to localhost by default and require `INTERNAL_SERVICE_TOKEN`.

### Coffee & Chat API

- Public: `GET /public/deals`, `/public/deals/:alias`, `/public/pulse`, `/public/constellation`
- Investor: `POST /coffee-sessions`, `POST /coffee-sessions/:id/venue`, `POST /coffee-sessions/:id/checkout`
- Startup: `POST /coffee-sessions/:id/respond`
- Members: `GET /coffee-sessions/:id`, `POST /coffee-sessions/:id/feedback`
- Host admin: `POST /coffee-sessions/:id/check-in`
- PayOS: `POST /webhooks/payos` (signature checked; duplicate events are idempotent)

## Local quick start

Requirements: Node.js 20.19+ and Docker with Compose.

```bash
./start.sh
```

This copies the local `.env.example` files on first run, starts pgvector and the three services, then serves the web app at `http://localhost:5173`.

For a single-container-stack deployment on a VPS, copy `.env.example` to `.env`, replace every secret, then run `docker compose up -d --build`. PostgreSQL and the raw gateway port bind only to loopback; matching and extraction remain on the private Compose network. Nginx exposes the browser app and proxies its gateway requests.

To add clearly-labelled scripted demo records after the services are healthy:

```bash
cd backend/gateway
npm run seed:demo
```

Demo records use reserved `.example` domains and are not real companies or research evidence. The seed also creates 12 anonymized deals, 3 fictional partner venues, and scripted Pulse events. It is blocked when `NODE_ENV=production`; the public frontend fallback is visibly labelled “Dữ liệu minh họa”.

## Data refresh policy

`source-refresh` runs once per day and checks each due source no more than weekly. It accepts founder submissions, official websites, accelerator/portfolio pages, official press, and RSS. It refuses LinkedIn/social scraping, non-HTTPS URLs, redirects, private networks, and responses above 2 MB. Unchanged content hashes do not create a new event; records older than 30 days become stale and disappear from the public feed.

The refresh worker checks provenance and freshness. It does not silently replace human verification: publishing a new deal or resolving conflicting evidence still requires the existing moderation/research pipeline.

## Production requirements

- Replace `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, and the local database password.
- Keep extraction and matching on a private network; expose only the gateway.
- Run gateway migrations before accepting traffic. Gateway startup also applies pending migrations transactionally.
- For an external database, set `DB_SSL=true` and keep certificate verification enabled. The bundled PostgreSQL container stays on the private Compose network.
- Configure the frontend so `/api/backend/*` proxies to the gateway.
- Set `PUBLIC_WEB_URL` and real `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, and `PAYOS_CHECKSUM_KEY`. `PAYMENT_PROVIDER=mock` is rejected in production.
- Configure the PayOS webhook to `/webhooks/payos`. Never treat the browser return URL as payment proof.
- Add `GOOGLE_PLACES_API_KEY` only when venue records are enriched through Google Places; preserve required attribution and never cache expiring photo names.
- Do not run the scripted demo seed in production.

## Validation

```bash
(cd frontend && npm ci && npm run build)
(cd backend/gateway && npm ci && npm test)
(cd backend/agent/extract && npm ci && npm test)
(cd backend/matching-engine && npm ci && npm test)
(cd ai-data-platform && uv run pytest -q)
```

Database-backed authorization and migration checks require a reachable PostgreSQL/pgvector instance. Unit tests cover blind-deal redaction, Coffee & Chat input invariants, PayOS signatures, source-network safety, verification, internal-service authentication, extraction routes, and matching confidence/scoring.

## Honest product limits

- A fit score is an estimate, not an investment recommendation.
- “Met offline” means a VietNexus host recorded attendance. It is not a fraud check or a guarantee.
- Venue suggestions are recommendations; a human host confirms availability and suitability.
- The pilot is Hanoi-only, one investor and up to five startups per 90-minute session.
- Missing fields lower confidence and are shown to the user.
- Domain matching prioritizes a profile for review but does not prove email ownership. A moderator must approve the profile before connection requests are enabled.
- There is no in-app chat in the MVP. Accepted members exchange email or LinkedIn.
- Opportunity content is member-authored and must be reportable/moderated.
