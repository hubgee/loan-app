# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project).

## Deploying the frontend on Vercel (free plan)

This repo is a Vite + React SPA that talks to a separate Laravel backend. The
frontend only needs static hosting; the API is reached directly from the
browser using the `VITE_API_URL` env var.

### 1. Push this repo to GitHub/GitLab/Bitbucket

### 2. Create a new Vercel project (import the repo)

Vercel auto-detects Vite from `vercel.json`. Confirm these settings:

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### 3. Add the environment variable

| Name           | Value                             |
| -------------- | --------------------------------- |
| `VITE_API_URL` | `https://your-backend-domain.com` |

The frontend appends `/api` and `/sanctum` to this origin automatically.
Locally (no var set) it falls back to `/api`, which the Vite dev proxy forwards
to `http://127.0.0.1:8000`.

### 4. Backend CORS (required for cookie/session auth)

Set the following on the Laravel backend so it accepts requests from Vercel:

- `FRONTEND_URL=https://your-vercel-app.vercel.app`
- `SANCTUM_STATEFUL_DOMAINS=your-vercel-app.vercel.app`
- `SESSION_DOMAIN=` (leave empty for cross-origin cookies, or set to the backend domain)
- `APP_URL=https://your-backend-domain.com`

`config/cors.php` already allows credentials and reads `FRONTEND_URL`, so the
frontend can authenticate cross-origin with `withCredentials: true`.

### 5. Deploy

Click **Deploy**. After it builds, visit the URL. Client-side routes
(e.g. `/dashboard`) are handled by the SPA rewrite in `vercel.json`.

> Note: The free Vercel plan hosts only the frontend. The Laravel backend must
> be hosted separately (e.g. Render, Railway, Fly.io) since Vercel cannot run
> PHP.
