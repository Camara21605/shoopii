# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check (`tsc -b`) then build for production
- `npm run lint` — run ESLint over the project
- `npm run preview` — preview the production build

There is no test runner configured in this project.

The backend API base URL comes from `VITE_API_URL` (defaults to `http://localhost:3001/api` — see `src/shared/services/apiFetch.ts`). The backend is a separate NestJS project (validation errors are returned as `message: string[]`, handled by `extractMessage` in `apiFetch.ts`).

## Architecture

This is a React 19 + TypeScript + Vite SPA using `react-router-dom` v7 and Tailwind v4 (via `@tailwindcss/vite`). The `@` import alias points to `src/`.

### Top-level structure

- `src/app/` — entry point (`App.tsx`), global providers (`AppProviders.tsx`), and the router (`router.tsx`)
- `src/modules/` — feature modules for the public-facing site: `auth` (login/register/OTP), `home` (storefront, boutique, produit, panier, messagerie, livreurs, correspondants pages), plus `commandes`, `livraisons`, `abonnements`, `utilisateurs`, `messagerie`
- `src/dashboards/` — one self-contained app per user role: `super-admin`, `administrateur`, `entreprise`, `partenaire`, `livreur`, `correspondant`, `client`
- `src/shared/` — cross-cutting code: `services/apiFetch.ts` (HTTP client + token storage), `services/authUtils.ts` (JWT helpers), `context/` (AppContext, ToastContext, CartContext), reusable `components/`, `hooks/`, and a shared `messagerie/` implementation
- `src/styles/global.css` — global styles/reset, imported by `App.tsx`

### Routing & auth (src/app/router.tsx)

- Auth state is derived entirely from a JWT stored in `localStorage` under `shopi_access_token` (`tokenStorage` in `apiFetch.ts`). The role is read straight out of the decoded token payload via `getRoleFromToken()` (`src/shared/services/authUtils.ts`) — there is no separate auth context/provider.
- Route guards in `router.tsx`:
  - `PrivateRoute` — requires a valid token, else redirects to `/login`
  - `PublicOnlyRoute` — used for `/login` and `/register`; redirects authenticated users to their dashboard
  - `HomeRoute` / `SmartRedirect` — route non-client roles away from `/home` and `/` to their dashboard via `getDashboardPath(role)`
- Each dashboard app (`*App.tsx`, e.g. `EntrepriseApp`, `LivreurApp`, `SuperAdminApp`, ...) is lazy-loaded and mounted at `/dashboard/<role>/*`. Legacy shortcut paths (`/entreprise/*`, `/livreur/*`, etc.) redirect to the `/dashboard/...` paths.
- `getDashboardPath()` maps backend role strings (`super_admin`, `admin`, `company`, `partner`, `delivery`, `correspondent`, `client`) to dashboard URL segments — note `company` → `/dashboard/entreprise`, `delivery` → `/dashboard/livreur`, `partner` → `/dashboard/partenaire`.

### Dashboard app structure

Each app under `src/dashboards/<role>/` is **not** built with nested React Router routes. Instead each has a top-level `*App.tsx` that:
1. Wraps everything in `ToastProvider` and renders a layout component
2. Holds an `activePage` state (a string union type, e.g. `EntreprisePage` from `./types`)
3. Renders `Sidebar`/`Topbar` (in `layout/`) which call an `onNavigate(page, ...)` callback to change `activePage`
4. A `PageRenderer` switch statement maps `activePage` to a component from `pages/`

Within a dashboard, common subfolders are: `layout/` (Sidebar, Topbar), `pages/`, `sections/` (page subsections, often for `parametres`/settings screens), `components/`, `data/` (mock data — most dashboards are still mock-data driven), `hooks/`, `styles/` (CSS Modules), `types/`.

### Roles

User roles (`src/modules/auth/types.ts` / `roleConfigs.ts`) are: `client`, `company`, `delivery`, `partner`, `correspondent`, `admin`, `super_admin`. `ROLE_CONFIGS` in `src/modules/auth/roleConfigs.ts` drives the registration UI (icons, labels, activation-code requirements per role).

### Styling

A mix of approaches coexists: global CSS (`src/styles/`), plain per-component `.css` files, and CSS Modules (`*.module.css`), plus Tailwind v4 utility classes. When editing a dashboard or page, match the styling approach already used by sibling files in that folder.
