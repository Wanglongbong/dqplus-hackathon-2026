# VietNexus — trusted startup–investor community

VietNexus helps verified founders and investors discover credible matches, understand the evidence behind each fit, and exchange contact details only after both sides accept a connection.

## Core journey

1. Create a founder or investor account.
2. Complete a role-specific profile and submit a work-email domain plus company website for moderation.
3. Refresh the evidence-backed profile and review estimated matches with confidence limits.
4. Edit and send a connection request. The recipient may accept, save, decline, or report it.
5. Contact details unlock only after acceptance.
6. Members can also publish time-limited fundraising, investment, pilot, and partnership opportunities.

Only this journey is presented as live. Native mobile remains a design prototype using mock data. `ai-data-platform/` is the research/provenance pipeline and admin reference implementation; the public web client never talks directly to an agent service.

## Architecture

```text
Browser → Gateway (JWT + ownership) → PostgreSQL
                  ├→ Extract service (private service token)
                  └→ Matching service (private service token)

ai-data-platform/ → sourced research, agent orchestration, verification and cost ledger
```

The gateway is the only public API. Profile contacts are excluded from discovery and opportunity responses. Matching and extraction bind to localhost by default and require `INTERNAL_SERVICE_TOKEN`.

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

Demo records use reserved `.example` domains and are not real companies or research evidence. The seed is blocked when `NODE_ENV=production`.

## Production requirements

- Replace `JWT_SECRET`, `INTERNAL_SERVICE_TOKEN`, and the local database password.
- Keep extraction and matching on a private network; expose only the gateway.
- Run gateway migrations before accepting traffic. Gateway startup also applies pending migrations transactionally.
- For an external database, set `DB_SSL=true` and keep certificate verification enabled. The bundled PostgreSQL container stays on the private Compose network.
- Configure the frontend so `/api/backend/*` proxies to the gateway.
- Do not run the scripted demo seed in production.

## Validation

```bash
(cd frontend && npm ci && npm run build)
(cd backend/gateway && npm ci && npm test)
(cd backend/agent/extract && npm ci && npm test)
(cd backend/matching-engine && npm ci && npm test)
(cd ai-data-platform && uv run pytest -q)
```

Database-backed authorization and migration checks require a reachable PostgreSQL/pgvector instance. The unit suites cover verification, internal-service authentication, extraction routes, and matching confidence/scoring.

## Honest product limits

- A fit score is an estimate, not an investment recommendation.
- Missing fields lower confidence and are shown to the user.
- Domain matching prioritizes a profile for review but does not prove email ownership. A moderator must approve the profile before connection requests are enabled.
- There is no in-app chat in the MVP. Accepted members exchange email or LinkedIn.
- Opportunity content is member-authored and must be reportable/moderated.
