# Self-Hosting Guide

Shuffle Security is a **frontend-only application** - it contains no backend, no database, and no server-side logic. It is a purpose-built UI layer on top of your existing [Shuffle Automation](https://shuffler.io) instance, focused entirely on security operations: incident triage, case management, and automated response.

All data, workflows, authentication, and integrations are handled by your Shuffle backend. This app simply presents them through a security-focused interface.

```
┌──────────────────────────────────────────────────────────────┐
│                     Your Environment                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────┐       ┌─────────────────────────┐    │
│   │ Shuffle Security │ ────▶ │   Shuffle Automation    │    │
│   │  (Static Files)  │ ◀──── │      (Backend API)      │    │
│   └──────────────────┘       └─────────────────────────┘    │
│          │                              │                    │
│          │                              │                    │
│          ▼                              ▼                    │
│   Browser (User)              Database, Workflows, Apps      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before self-hosting, you need:

- A running **Shuffle Automation** instance (Cloud or self-hosted)
- **Node.js 18+** and **npm** (or Bun)
- Network connectivity between the browser and your Shuffle backend

> **Important:** Shuffle Security does not replace Shuffle Automation. It requires a Shuffle backend to function. Without one, there is nothing to display.

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Shuffle/security.git
cd security
```

### 2. Configure the backend URL

Create a `.env` file pointing to your Shuffle instance:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Shuffle Cloud (EU) - default
VITE_SHUFFLE_API_URL=https://shuffler.io

# Shuffle Cloud (US)
VITE_SHUFFLE_API_URL=https://us.shuffler.io

# Self-hosted Shuffle
VITE_SHUFFLE_API_URL=https://shuffle.yourdomain.com
```

### 3. Build and serve

```bash
npm install
npm run build
```

The output is a set of static files in `dist/`. Serve them with any web server:

```bash
# Using a simple static server
npx serve dist

# Or copy to Nginx, Caddy, S3, etc.
```

---

## Deployment Options

Since Shuffle Security is just static HTML, CSS, and JavaScript, you can host it anywhere:

| Method | Notes |
|--------|-------|
| **Nginx / Caddy** | Serve the `dist/` folder. Add a catch-all rule for SPA routing |
| **Docker** | Wrap in an Nginx container. See example below |
| **S3 + CloudFront** | Upload `dist/` to S3, serve via CloudFront with SPA error handling |
| **Vercel / Netlify** | Connect the repo and set `VITE_SHUFFLE_API_URL` as an environment variable |
| **Behind Shuffle** | Serve alongside your existing Shuffle instance on a subpath or subdomain |

### Docker Example

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Shuffle Cloud Regions

If you're using Shuffle Cloud (not self-hosted), select the region closest to your users:

| Region | URL |
|--------|-----|
| **EU (Default)** | `https://shuffler.io` |
| **US** | `https://us.shuffler.io` |

The app automatically detects your organization's region after login via the `/api/v1/getinfo` endpoint and routes subsequent requests accordingly.

---

## Authentication

Shuffle Security uses the same authentication as your Shuffle backend:

1. User enters credentials in the login page
2. Credentials are sent to `POST /api/v1/login` on your Shuffle instance
3. Shuffle returns a session cookie
4. All subsequent API calls include the cookie via `credentials: 'include'`

There is no separate user database, no social login, and no password recovery - all of that is managed by Shuffle Automation.

For development or automation, you can also authenticate with a Shuffle API key using the **Developer: Use API Key** option on the login page.

---

## CORS Configuration (Required for Cross-Origin)

If Shuffle Security is hosted on a different domain than your Shuffle backend, you must configure CORS on Shuffle to allow requests:

```yaml
# Docker environment variable for Shuffle
SHUFFLE_ALLOWED_ORIGINS=https://security.yourdomain.com
```

Without this, the browser will block API requests due to cross-origin restrictions.

> **Tip:** If you serve Shuffle Security on the same domain as Shuffle (e.g., as a subpath), CORS is not needed.

---

## What This App Does - and Doesn't Do

### It does:

- Provide a dedicated **incident triage and case management** UI
- Display your **connected integrations** and their authentication status
- Visualize **data flows** between your security tools
- Trigger and monitor **automated workflows** via Shuffle
- Offer an **onboarding wizard** to connect tools and enable automation

### It does not:

- Store any data (all data lives in Shuffle)
- Run any backend code (it's pure client-side JavaScript)
- Replace Shuffle Automation (it's a specialized view on top of it)
- Handle authentication independently (delegated to Shuffle)

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Blank page after login | Wrong `VITE_SHUFFLE_API_URL` | Verify the URL points to your Shuffle instance and rebuild |
| CORS errors in console | Cross-origin requests blocked | Add your domain to `SHUFFLE_ALLOWED_ORIGINS` on Shuffle |
| 401 on every request | Session cookie not sent | Ensure same-site or configure CORS with credentials |
| Page not found on refresh | SPA routing not configured | Add `try_files $uri /index.html` to your web server |
| API calls hit wrong region | Region URL not resolving | Check that `/api/v1/getinfo` returns the correct `region_url` |

---

## Next Steps

- **[Getting Started](/docs/getting-started)** - Walk through the onboarding flow
- **[Shuffle API Documentation](https://shuffler.io/docs/API)** - Full API reference
- **[Shuffle Automation](https://shuffler.io)** - Manage workflows, apps, and backend configuration
