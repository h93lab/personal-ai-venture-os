# Venture OS

Venture OS is a private, AI-assisted venture intelligence workspace for managing knowledge, ideas, projects, market discovery, competitors, AI tasks, GitHub health, and Telegram notifications. The repository is prepared as a clean application export: the database schema and migrations remain available, while the current application data has been removed.

## Requirements

For a VPS deployment, install Docker Engine and the Docker Compose plugin. A practical baseline is 2 vCPU, 2 GB RAM, 20 GB SSD, and a domain name terminated through a reverse proxy such as Caddy or Nginx. The application listens on `PORT` inside the container and the compose file publishes it through `APP_PORT`.

## Quick start with Docker Compose

Copy `deployment.env.example` to `.env` and replace every `CHANGE_ME` value. This file is the export-safe environment template; it contains placeholders only. The application container must use the database hostname `db`, not `localhost`.

```bash
cp deployment.env.example .env
# edit .env and replace all CHANGE_ME values

docker compose up -d --build

docker compose logs -f app
```

The app applies committed Drizzle migrations before starting the production server. Open `http://YOUR_VPS_IP:${APP_PORT:-3000}` or place a reverse proxy in front of the published port. OAuth callback configuration must use the public HTTPS URL required by the OAuth provider.

## Required environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | MySQL/TiDB connection string used by the app. Compose derives it from the database variables. |
| `JWT_SECRET` | Yes | Long random secret for session signing. Use at least 32 random characters. |
| `VITE_APP_ID` | Yes | OAuth application identifier. |
| `OAUTH_SERVER_URL` | Yes | OAuth backend base URL. |
| `VITE_OAUTH_PORTAL_URL` | Yes | Browser OAuth portal URL. |
| `OWNER_OPEN_ID` | Yes | Owner identifier used by the application integration layer. |
| `BUILT_IN_FORGE_API_URL` | Yes | Server-side Manus Forge endpoint for AI, storage, notifications, and Heartbeat. |
| `BUILT_IN_FORGE_API_KEY` | Yes | Server-side Forge credential. Never expose it to the browser. |
| `VITE_FRONTEND_FORGE_API_URL` | Yes | Frontend Forge endpoint. |
| `VITE_FRONTEND_FORGE_API_KEY` | Yes | Frontend Forge credential supplied by the connected Manus environment. |
| `MYSQL_DATABASE` | Yes | Database name for the Compose MySQL service. |
| `MYSQL_USER` | Yes | Database user for the Compose MySQL service. |
| `MYSQL_PASSWORD` | Yes | Database user password; it must match the password embedded in `DATABASE_URL` when running outside Compose. |
| `MYSQL_ROOT_PASSWORD` | Yes | MySQL root password used only by the database container healthcheck and administration. |
| `NODE_ENV` | Yes | Set to `production`. |
| `PORT` | Yes | Internal application port; default `3000`. |
| `APP_PORT` | No | Host port published by Compose; default `3000`. |

## OAuth setup

Register the public HTTPS origin and the exact callback route required by the Manus OAuth integration in the OAuth application settings. Do not copy the values from the old development preview URL into a VPS deployment. `VITE_OAUTH_PORTAL_URL` is the OAuth portal base URL and must be a complete HTTPS URL such as `https://manus.im`; it is not the VPS domain and must not contain `CHANGE_ME`, quotes, or a path copied from the callback URL. `VITE_APP_ID` must also be the real OAuth application ID.

The frontend reads `VITE_*` values during the image build, so changing them requires rebuilding the app image, not only restarting the container:

```bash
# validate the values first; no placeholder should remain
 grep -E '^(VITE_APP_ID|VITE_OAUTH_PORTAL_URL)=' .env
 docker compose up -d --build --force-recreate app
 docker compose logs --tail=100 app
```

The application now validates OAuth configuration before constructing the login URL and shows the missing/invalid variable instead of a generic `TypeError: Invalid URL`. After changing OAuth values, recreate the app container with `docker compose up -d --build --force-recreate app`.

## Database operations

The production container runs `drizzle-kit migrate` on startup. Do not run destructive schema commands against a production database. Before upgrades, create a MySQL backup:

```bash
docker compose exec db sh -c 'exec mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers "$MYSQL_DATABASE"' > venture-os-$(date +%Y%m%d-%H%M%S).sql
```

Restore only after verifying the target database and backup file:

```bash
cat backup.sql | docker compose exec -T db sh -c 'exec mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
```

## Operations and monitoring

Heartbeat jobs are managed by the configured scheduling service, not by an in-container cron process. Discovery and GitHub callbacks apply their own gating rules for local timezone, selected refresh intervals, and duplicate execution. Monitor the app and database with `docker compose ps`, `docker compose logs --tail=200 app`, and `docker compose logs --tail=200 db`.

Rotate `JWT_SECRET`, Forge credentials, and database credentials through your secret manager or VPS deployment process. A JWT rotation invalidates active sessions and requires users to authenticate again. Keep the database volume and backups on encrypted storage.

## Development

```bash
corepack pnpm install
corepack pnpm check
corepack pnpm test
corepack pnpm test:browser
corepack pnpm build
```

The current verification baseline is TypeScript clean, 41 Vitest tests passing, a successful production build, a four-route Chromium smoke test, and a clean production dependency audit. The browser smoke test validates application boundaries and lazy-route loading; it does not replace a real authenticated end-to-end test with a dedicated test OAuth account.

## Security notes

Secrets are stored server-side and sensitive integration values are encrypted and masked. External GET integrations use SSRF validation, timeouts, limited retries, and response handling. Requests use same-origin CSRF checks and route-aware rate limiting. For multi-instance or high-traffic deployments, replace the in-process rate limiter with a shared Redis or gateway policy before exposing the service broadly.

## Project structure

The React client is under `client/`, the tRPC and integration layer under `server/`, Drizzle schema and migrations under `drizzle/`, and deployment files at the repository root. `Dockerfile` builds both the frontend and server; `docker-compose.yml` supplies MySQL and starts migrations before the app.
