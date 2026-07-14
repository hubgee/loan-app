# Deploy loan-app (Laravel API + React/Vite) to Free Hosting

## Context

The repo is a **monorepo**:
- **Frontend**: React + Vite at repo root. `npm run build` → `dist/`. Today it calls the API with a
  hard-coded relative `baseURL: "/api"` and relies on the Vite dev proxy (`vite.config.js`) to forward
  `/api` and `/sanctum` to `http://127.0.0.1:8000`.
- **Backend**: Laravel 13 (PHP ^8.3) in `backend/`, served by `php artisan serve` on `:8000`.
  - Auth = session + Sanctum, `SANCTUM_STATEFUL_DOMAINS` / `SESSION_DOMAIN` / `FRONTEND_URL` / CORS all
    hard-coded to `localhost:5173` / `localhost` (see `backend/.env`).
  - DB = PostgreSQL locally; `database.php` default falls back to **sqlite** when `DB_CONNECTION` unset.
  - National ID uploads stored on the `private` local disk under `ids/` (`LoanApplicationController.php:25`).

Goal: get a working public URL for testing / client review, **free**, accepting ephemeral storage
(user chose: SQLite + ephemeral uploads). The DB file and uploads will reset on server restart — fine
for a demo, not for real data.

## Required changes before ANY deployment (platform-agnostic)

These are code/config edits an implementation agent must make; they apply to every option below.

1. **Make the frontend API URL configurable** (`src/api/client.js`):
   - `baseURL: import.meta.env.VITE_API_URL ?? '/api'` (keeps `/api` in dev so the Vite proxy still works).
   - In `getCsrf()`, change `axios.get("/sanctum/csrf-cookie", …)` → `api.get("sanctum/csrf-cookie")`
     so it also honours `VITE_API_URL`.
   - Add `VITE_API_URL=https://<backend-url>` as a build-time env var on the host.

2. **Backend production env** (set as platform env vars, do NOT commit secrets). Key values:
   ```
   APP_ENV=production
   APP_DEBUG=false
   APP_KEY=            # generate fresh: php artisan key:generate
   APP_URL=https://<backend-url>

   DB_CONNECTION=sqlite
   # DB_DATABASE left default -> backend/database/database.sqlite (auto-created by migrate)

   SESSION_DRIVER=database      # sessions table migration exists; works on sqlite
   SESSION_SECURE_COOKIE=true
   SESSION_DOMAIN=             # leave empty -> cookie scoped to the API host
   QUEUE_CONNECTION=sync       # no worker process on free tiers; run jobs inline

   FRONTEND_URL=https://<frontend-url>     # drives CORS allowed_origins
   SANCTUM_STATEFUL_DOMAINS=<frontend-host> # host only, e.g. loan-app.onrender.com (no scheme/port)

   FILESYSTEM_DISK=private      # local; uploads are ephemeral on free hosts (accepted)
   MAIL_MAILER=log
   ```
   Note: `config/cors.php` already reads `FRONTEND_URL` for `allowed_origins` and includes
   `api/*` + `sanctum/csrf-cookie`, so CORS is covered once `FRONTEND_URL` is set.

3. **Ensure SQLite file exists / migrations run** on boot. On ephemeral disks the DB is wiped on
   restart, so the start command must migrate on every boot:
   `php artisan migrate --force && php artisan serve --host 0.0.0.0 --port $PORT`.
   Optionally seed an admin after migrate so the dashboard is usable after each cold start
   (`php artisan db:seed --force` or a one-off `artisan tinker` registration).

## Free platform options

### Option A — Render (RECOMMENDED, single provider, fully free)
Two free services in one Render account: a **Static Site** (frontend) and a **Web Service** (Laravel).

**Backend Web Service**
- New → Web Service, connect the GitHub repo, set *Root Directory* = `backend`.
- Runtime auto-detects PHP 8.3 from `composer.json`.
- Build Command: `composer install --no-dev --optimize-autoloader`
- Start Command: `php artisan migrate --force && php artisan serve --host 0.0.0.0 --port $PORT`
- Add the env vars from step 2 above.
- Result URL, e.g. `https://loan-app-api.onrender.com`.

**Frontend Static Site**
- New → Static Site, same repo, *Root Directory* = `.` (repo root).
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Add env `VITE_API_URL=https://loan-app-api.onrender.com` (use the backend URL above).
- Result URL, e.g. `https://loan-app.onrender.com` — this is the link you give the client.

Caveats: free web service spins down after ~15 min idle (cold start wipes the SQLite DB + uploads,
~30–60 s delay on first hit); admin must re-register after each restart unless seeded.

### Option B — Railway (alternative, $5 free credit, similar shape)
- New project → deploy from GitHub repo.
- Add a **PHP service** with Root = `backend`, same build/start/env as Option A.
- Add a **Static service** (or use the Node service running `npm run build` and serving `dist`) with
  `VITE_API_URL` pointing at the PHP service URL.
- Railway free tier is credit-based (not unlimited) and disks are ephemeral by default; same data-reset
  behaviour as Render. Good if Render's spin-down is a problem (Railway stays warmer, within credit).

### Option C — Vercel or Netlify (frontend) + Render/Railway (backend)
- Frontend on **Vercel** (import repo, Framework = Vite, Build `npm run build`, Output `dist`, env
  `VITE_API_URL=<backend-url>`) or **Netlify** (Build `npm run build`, Publish `dist`, same env).
- Backend exactly as Option A (Render) or Option B (Railway).
- Use when you want a nicer frontend URL / global CDN; backend story unchanged.

### Option D — Fly.io (advanced, Docker)
- Requires adding a `Dockerfile` + `fly.toml` for the Laravel service (start `php artisan serve` or
  nginx+php-fpm). Free allowance = 3 shared VMs; **volumes are paid**, so SQLite stays ephemeral.
- Frontend can be a second Fly app or served from Vercel/Netlify.
- More setup; only if you want to avoid Render/Railway entirely.

## Risks / caveats
- **Ephemeral data (accepted)**: SQLite DB + `ids/` uploads reset on every backend restart/cold start.
  Re-register admin / re-submit after restarts unless an admin seeder is added.
- **Cross-domain session cookie**: frontend and backend are on different hosts. Sanctum stateful
  domains + `FRONTEND_URL` + `SESSION_SECURE_COOKIE=true` must be set exactly as in step 2, or login
  will fail with 401/419 CSRF. Verify in the browser that the session cookie is set on the API host and
  sent with `withCredentials`.
- **Free-tier cold starts**: first request after idle can be slow; the DB migrate-on-boot adds latency.
- **`php artisan serve` is not production-grade** but fine for a low-traffic demo. (nginx+php-fpm is
  better but adds config; out of scope for free quick deploy.)
- Never commit `.env` secrets; set them only as platform env vars.

## Validation
1. Open the **frontend** URL (e.g. `https://loan-app.onrender.com`) — UI loads, no 404.
2. Submit a loan application on `/` or `/apply` → 201 success; uploaded file stored under `ids/`.
3. Register/log in as admin at `/login` → reaches `/dashboard` (proves CORS + Sanctum cookie works).
4. Approve/Repaid an application and confirm the stats update.
5. Check backend logs for any 401/419/CSRF or CORS errors and confirm `VITE_API_URL` is correct.
6. (Optional) trigger a backend restart and confirm data resets as expected for the ephemeral tier.
