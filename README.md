# Venture OS

Venture OS is a self-hosted, AI-assisted venture intelligence workspace for managing knowledge, ideas, projects, market discovery, competitors, AI tasks, GitHub health, and Telegram notifications. The repository is prepared as a clean application export: the schema and migrations remain available, while application data has been removed.

## Architecture

The platform runs as a React 19 + Tailwind 4 frontend, an Express 5 + tRPC backend, and MySQL through Drizzle ORM. Authentication is local PIN-based authentication with a signed, HTTP-only JWT cookie; there is no OAuth callback or Manus account dependency. AI calls use an OpenAI-compatible API configured by `AI_API_BASE_URL` and `AI_API_KEY`. GitHub and Telegram are direct integrations configured from the application settings or deployment environment. Scheduled callbacks authenticate with an internal scheduler token and are designed to be invoked by the self-hosted Docker scheduler.

## Requirements

For a VPS deployment, install Docker Engine and the Docker Compose plugin. A practical baseline is 2 vCPU, 2 GB RAM, 20 GB SSD, and a domain terminated through a reverse proxy such as Caddy or Nginx. The application listens on `PORT` inside the container and Compose publishes it through `APP_PORT`.

## Quick start with Docker Compose

Copy `deployment.env.example` to `.env` and replace every `CHANGE_ME` value. The application container must use the database hostname `db`, not `localhost`.

```bash
cp deployment.env.example .env
# edit .env and replace every CHANGE_ME value

docker compose up -d --build

docker compose logs -f app
```

Open `http://YOUR_VPS_IP:${APP_PORT:-3000}` or place a reverse proxy in front of the published port. On first installation, use the value configured in `LOCAL_AUTH_PIN`; the supplied template intentionally leaves this as a deployment secret. Change it after installation by updating the environment and recreating the app container.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | MySQL connection string used by the backend. |
| `JWT_SECRET` | Yes | Long random secret used to sign local sessions. Use at least 32 random characters. |
| `LOCAL_AUTH_PIN` | Yes | Initial local PIN, 4–12 digits. Keep it outside Git and rotate it after installation. |
| `AI_API_BASE_URL` | Yes for AI | Base URL of an OpenAI-compatible provider, such as OpenAI, OpenRouter, Ollama, vLLM, or a private gateway. |
| `AI_API_KEY` | Yes for hosted AI | Server-side API key for the selected provider. Leave empty only when using a local provider that does not require a key. |
| `AI_MODEL` | Recommended | Default model identifier used by AI operations. |
| `SCHEDULER_TOKEN` | Yes for scheduled jobs | Internal token sent by the Docker scheduler in `x-scheduler-token`. |
| `MYSQL_DATABASE` | Yes | Database name for the Compose MySQL service. |
| `MYSQL_USER` | Yes | Database user for the Compose MySQL service. |
| `MYSQL_PASSWORD` | Yes | Database user password; it must match `DATABASE_URL`. |
| `MYSQL_ROOT_PASSWORD` | Yes | Root password used by the MySQL container. |
| `NODE_ENV` | Yes | Set to `production`. |
| `PORT` | Yes | Internal application port; default `3000`. |
| `APP_PORT` | No | Host port published by Compose; default `3000`. |

GitHub and Telegram credentials may be entered through Settings. If environment-level defaults are used, keep `GITHUB_TOKEN`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` in the deployment secret manager rather than committing them.

## AI provider guidance

The backend speaks the standard `/v1/chat/completions` and `/v1/models` OpenAI-compatible endpoints. This allows the deployment to use a hosted provider for the strongest content quality or a local gateway such as Ollama or vLLM for privacy and predictable operating costs. The API key is never sent to the browser. Provider connectivity and model discovery should be tested from Settings before enabling automated AI tasks.

## Scheduled work

Scheduled refreshes are self-hosted. Callback routes under `/api/scheduled/*` require the `x-scheduler-token` header and a `taskUid` in the JSON body. The scheduler must invoke the endpoint over the internal Compose network or through the public reverse-proxy URL. Do not expose the scheduler token to the browser or Telegram.

The callback handlers are idempotent and apply their own time-zone, refresh-window, and duplicate-run gates. In production, use a durable cron runner or an external VPS scheduler that survives application restarts; do not depend on an in-process timer.

## Database operations

The production container runs committed Drizzle migrations on startup. Do not run destructive schema commands against a production database. Before upgrades, create a MySQL backup:

```bash
docker compose exec db sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "$MYSQL_DATABASE"' > venture-os-$(date +%Y%m%d-%H%M%S).sql
```

Restore only after verifying the target database and backup file:

```bash
cat backup.sql | docker compose exec -T db sh -c 'exec mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
```

## Operations and security

Use `docker compose ps`, `docker compose logs --tail=200 app`, and `docker compose logs --tail=200 db` for basic monitoring. Rotate `JWT_SECRET`, `LOCAL_AUTH_PIN`, `SCHEDULER_TOKEN`, AI credentials, and database credentials through the VPS secret manager. Rotating `JWT_SECRET` invalidates active sessions. Keep the database volume and backups on encrypted storage, and place the public app behind HTTPS.

The application uses server-side secret storage, encryption and masking for sensitive integrations, SSRF validation, timeouts, limited retries, same-origin CSRF checks, route-aware rate limiting, and temporary PIN lockout after repeated failures. For multi-instance or high-traffic deployments, replace the in-process rate limiter with a shared Redis or gateway policy.

## Development and verification

The Dockerfile installs the exact pnpm version declared by the project (`10.4.1`) directly instead of relying on Corepack's signature and release lookup. It still uses `pnpm install --frozen-lockfile`, so dependency resolution remains strictly validated against `pnpm-lock.yaml`. The `dist/` directory is intentionally excluded from the Docker build context because the image runs the complete frontend and server build internally.

```bash
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test
pnpm test:browser
pnpm build
```

The current verification baseline includes a clean TypeScript check, 44 Vitest tests, a successful production build, and authenticated local-PIN smoke coverage. Browser tests should be run against a configured local environment before each VPS release.

## Project structure

The React client is under `client/`, the tRPC and integration layer under `server/`, the Drizzle schema and migrations under `drizzle/`, and deployment files at the repository root. `Dockerfile` builds both the frontend and server; `docker-compose.yml` supplies MySQL and starts migrations before the app.
