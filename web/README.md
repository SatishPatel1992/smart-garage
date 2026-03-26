# Smart Garage – Web App

React web application with the same functionality as the mobile app, using the **same backend and database**.

## Setup

1. Install dependencies:
   ```bash
   cd web
   npm install
   ```

2. Start the **backend** (from project root):
   ```bash
   cd backend
   npm run dev
   ```
   Backend should run on `http://localhost:3000`.

3. Start the web app:
   ```bash
   cd web
   npm run dev
   ```
   App runs at `http://localhost:5173`.

The web app proxies API requests to the backend via Vite: requests to `/api/*` are forwarded to `http://localhost:3000/*`. To use a different backend URL, set `VITE_API_URL` (e.g. in `.env`):

```
VITE_API_URL=http://localhost:3000
```

Then the client will call that URL directly (no proxy).

## Features

- **Login** – Same auth as mobile; token stored in localStorage.
- **Dashboard** – Stats, quick actions, recent activity, attention items.
- **Jobs** – List, filter by stage, create job, job detail, update stage.
- **Billing** – Invoice list.
- **Customers** – List, search, add customer (with vehicles, make/model dropdowns), customer profile.
- **Estimates** – Placeholder (estimates are per-job; use Jobs to open a job).
- **Inventory / Payments / Reports** – Placeholders (extend as needed).
- **Settings** – Organization info from `/me`.
- **Profile** – Current user.
- **Users** – User list (admin only).

## Build

```bash
npm run build
```

Output is in `dist/`. Serve with any static host. Set `VITE_API_URL` to your production API URL when building for production.
