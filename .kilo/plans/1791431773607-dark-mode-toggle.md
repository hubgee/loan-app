# Dark Mode Toggle — Borrower & Admin Dashboards

## Goal
Add a dark mode toggle to the shared navbar, visible only on the borrower dashboard (`/loans`) and admin dashboard (`/dashboard`). The toggle persists the user's choice in `localStorage` and is applied app-wide via Tailwind's class-based dark mode. On first visit, the app respects the system `prefers-color-scheme` setting; once the user clicks the toggle, their explicit choice wins.

## Key Decisions
- **Toggle visibility**: Rendered only when the current route is `/loans` or `/dashboard`. The theme itself is applied globally (standard `<html>` class strategy), so navigating away from dashboards preserves the chosen theme.
- **Persistence**: `localStorage` key `darkMode`. No DB schema change.
- **Tailwind strategy**: `darkMode: 'class'`.
- **System detection**: On first load, if `localStorage` has no stored preference, read `window.matchMedia('(prefers-color-scheme: dark)')` and apply that. Once the user toggles, their choice overrides the system default.
- **Scope of dark mode classes**: App-wide. All pages/components get `dark:` variants, not just the two dashboards.
- **Implementation style**: Minimal invasive changes. Add `dark:` variants to existing Tailwind classes across the app. Keep the toggle small and unobtrusive.

## Tasks (ordered)

### 1. Update Tailwind config
**File**: `tailwind.config.js`
- Add `darkMode: 'class'` under `theme`.

### 2. Create `useDarkMode` hook
**New file**: `src/hooks/useDarkMode.js`
- On mount: if `localStorage.getItem('darkMode')` is set, apply that. Otherwise, check `window.matchMedia('(prefers-color-scheme: dark)')` and apply system default.
- Returns `[isDark, toggle]`.
- `toggle` flips the value, writes to `localStorage`, and syncs `document.documentElement.classList.toggle('dark', next)`.

### 3. Create `DarkModeToggle` component
**New file**: `src/components/DarkModeToggle.jsx`
- Small button showing ☀️ / 🌙 based on state.
- Uses `useDarkMode`.
- Accessible label: "Toggle dark mode".

### 4. Wire toggle into `Navbar`
**File**: `src/components/Navbar.jsx`
- Import `useLocation` from `react-router-dom` and `DarkModeToggle`.
- Render `<DarkModeToggle />` only when `location.pathname` is `/loans` or `/dashboard`.

### 5. Apply dark mode classes app-wide
**Files**: All `src/pages/*.jsx`, `src/components/*.jsx`
- Add `dark:` variants to backgrounds, text, borders, cards, inputs, modals, and navigation surfaces.
- Priority order for coverage:
  1. `Dashboard.jsx` (admin dashboard)
  2. `UserDashboard.jsx` (borrower dashboard)
  3. Shared components used by both dashboards (`Navbar.jsx`, `LoanTracker.jsx`, `LoanDetailView.jsx`, modals, etc.)
  4. Remaining pages and public components
- Ensure text contrast is readable in dark mode for all surfaces.

### 6. Validation
- Run `npm run dev` and manually verify:
  1. On first visit (no `localStorage`), the app matches the system `prefers-color-scheme`.
  2. Toggle appears on `/dashboard` and `/loans`, not on `/`, `/login`, `/signup`.
  3. Clicking the toggle switches themes immediately and persists after refresh.
  4. After toggling, the user's choice overrides the system default on subsequent visits.
  5. Dark mode carries over to non-dashboard pages (expected behavior).
  6. Text remains readable in dark mode across all pages.
- Run `npm run lint` / `npm run typecheck` if available.

## Out of Scope
- Per-user dark mode preference stored in Supabase.
- Animation/transition on theme switch.
