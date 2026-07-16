# Deploy loan-app Frontend on Vercel (Frontend Only)

## Context
`loan-app` is a Vite + React 19 SPA (`react-router-dom` v7, Tailwind v4). The frontend is
self-contained in the repo root (`index.html`, `src/`, `vite.config.js`). It currently expects a
Laravel-style backend reachable at `/api` and `/sanctum`, proxied to `http://127.0.0.1:8000` in dev
(`vite.config.js` `server.proxy`). Per the user: deploy **frontend only, no live API** yet — the
static UI should deploy, but API calls are not required to work right now.

Vercel auto-detects Vite projects, but a few settings still need to be explicit to avoid surprises.

## Goal
Build and deploy the static React frontend to Vercel. Keep it functional as a UI; leave the API base
configurable so a real backend can be wired in later without code changes.

## Decisions
- **No Vercel rewrites** for `/api` or `/sanctum` (no backend being hosted/deployed now).
- **API base URL externalized** via env var so it can be pointed at a real backend later.
- **SPA fallback** enabled so `react-router-dom` client routes (e.g. `/dashboard`) work on refresh/direct
  load — Vercel handles this automatically for the Vite framework preset.

## Steps

1. **Make the API base configurable (recommended, low effort)**
   - In `src/api/client.js`, replace the hardcoded `baseURL: "/api"` with:
     ```js
     baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
     ```
   - This keeps local dev behavior (`/api` proxied) and lets a future backend be set via
     `VITE_API_BASE_URL` without code edits. (Optional but recommended.)

2. **Add a Vercel config file** `vercel.json` at repo root to lock in the framework-free static build
   and SPA routing (optional since Vercel auto-detects Vite, but makes it explicit):
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "framework": "vite",
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
   Note: the catch-all rewrite sends all unknown paths to `index.html` for client-side routing.

3. **Verify the build works locally**
   - Run `npm run build` and confirm `dist/` is produced without errors.
   - (Optional) `npm run preview` to sanity-check the static output.

4. **Deploy to Vercel**
   - **Option A — Git integration (recommended):** Push to GitHub/GitLab, import the repo in Vercel,
     set Framework = Vite, Build Command = `npm run build`, Output Directory = `dist`. Deploy.
   - **Option B — Vercel CLI:** `npm i -g vercel`, then `vercel` (and `vercel --prod`) from repo root.
   - No environment variables required for frontend-only; if added later, set `VITE_API_BASE_URL`.

5. **Post-deploy check**
   - Visit the deployed URL, confirm UI loads and client-side navigation works (no 404 on refresh of
     a sub-route). API-dependent features will show errors until a backend exists — expected for now.

## Risks / Notes
- Currently `withCredentials: true` is set on `/api` and `/sanctum` calls. Without a same-origin backend
  this is harmless now; when a real backend is added later it must send proper CORS + cookie headers.
- `npm install` must run on Vercel (default). `node_modules/` is gitignored (confirmed), so it will be
  installed during build.
- Tailwind v4 uses `@tailwindcss/postcss`; build picks it up via `postcss.config.js` — no extra action.

## Validation
- `npm run build` succeeds locally and emits `dist/`.
- Deployed site loads and client routes resolve (SPA fallback works).
- No required env vars for current frontend-only scope.
