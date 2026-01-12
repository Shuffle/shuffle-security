# Setup Guide

This guide explains how to configure Shuffle Cases to connect to your Shuffle Automation backend.

## Prerequisites

Before setting up Shuffle Cases, ensure you have:

- A running **Shuffle Automation** instance (Cloud or self-hosted)
- Valid credentials to authenticate with your Shuffle instance
- Network connectivity between Shuffle Cases and your Shuffle backend

## Understanding the Connection

Shuffle Cases is a **frontend-only application** that communicates with the Shuffle Automation API. It does not store any data locally — all alerts, cases, and workflows are managed by your Shuffle backend.

```
┌──────────────────────────────────────────────────────────────┐
│                     Your Environment                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────┐         ┌─────────────────────────┐   │
│   │  Shuffle Cases  │  ────▶  │   Shuffle Automation    │   │
│   │   (This App)    │  ◀────  │      (Backend API)      │   │
│   └─────────────────┘         └─────────────────────────┘   │
│          │                              │                    │
│          │                              │                    │
│          ▼                              ▼                    │
│   Browser (User)              Database, Workflows, Apps      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Configuration Options

### Shuffle Cloud Regions

| Region | URL | Description |
|--------|-----|-------------|
| **EU (Default)** | `https://shuffler.io` | European data center |
| **US** | `https://us.shuffler.io` | United States data center |

### Self-Hosted

If you're running Shuffle on your own infrastructure:

| Setup | Example URL |
|-------|-------------|
| Custom domain | `https://shuffle.yourdomain.com` |
| Internal network | `https://shuffle.internal:3001` |
| Local development | `http://localhost:3001` |

---

## Configuration Methods

### Method 1: Environment Variable (Recommended)

The recommended approach is to set the `VITE_SHUFFLE_API_URL` environment variable.

#### Step 1: Create a `.env` file

In the root of your Shuffle Cases deployment, create a `.env` file:

```bash
# Copy the example file
cp .env.example .env
```

#### Step 2: Set your Shuffle URL

Edit the `.env` file:

```env
# For Shuffle Cloud (EU) - this is the default
VITE_SHUFFLE_API_URL=https://shuffler.io

# For Shuffle Cloud (US)
VITE_SHUFFLE_API_URL=https://us.shuffler.io

# For self-hosted Shuffle
VITE_SHUFFLE_API_URL=https://shuffle.yourdomain.com
```

#### Step 3: Rebuild the application

After changing environment variables, rebuild the application:

```bash
npm run build
```

---

### Method 2: Direct Configuration

If you prefer, you can modify the configuration file directly.

#### File to modify

```
src/config/api.ts
```

#### Configuration

Open `src/config/api.ts` and update the `baseUrl`:

```typescript
export const API_CONFIG = {
  // Change this to your Shuffle backend URL
  baseUrl: 'https://shuffle.yourdomain.com',  // ← Modify this line
  
  // API version
  version: 'v1',
};
```

#### Available options

```typescript
// Shuffle Cloud (EU) - Default
baseUrl: 'https://shuffler.io'

// Shuffle Cloud (US)
baseUrl: 'https://us.shuffler.io'

// Self-hosted example
baseUrl: 'https://shuffle.yourdomain.com'
```

---

## Authentication

Shuffle Cases uses the same authentication as Shuffle Automation. When you log in:

1. Your credentials are sent to the Shuffle API (`POST /api/v1/login`)
2. Shuffle returns a session token
3. The token is used for subsequent API requests
4. Sessions are managed by your Shuffle backend

### Important Notes

- **No social login** — Shuffle Cases uses username/password authentication only
- **Session management** — Sessions are controlled by your Shuffle instance settings
- **API keys** — For automation, you can also use Shuffle API keys

---

## Verifying the Connection

After configuration, verify your setup:

1. Navigate to Shuffle Cases in your browser
2. Click **Sign In**
3. Enter your Shuffle credentials
4. If successful, you'll be redirected to the dashboard

### Troubleshooting

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Connection refused | Wrong URL or Shuffle not running | Verify the URL and that Shuffle is accessible |
| CORS errors | Cross-origin requests blocked | Ensure Shuffle allows requests from your Cases domain |
| 401 Unauthorized | Invalid credentials | Check your username/password |
| Network timeout | Firewall or connectivity issue | Check network connectivity to Shuffle |

---

## CORS Configuration (Self-Hosted)

If you're running Shuffle Cases on a different domain than your Shuffle instance, you may need to configure CORS on your Shuffle backend.

In your Shuffle environment configuration, ensure the Cases domain is allowed:

```yaml
# Example: Docker environment variable
SHUFFLE_ALLOWED_ORIGINS=https://cases.yourdomain.com
```

Refer to the [Shuffle documentation](https://shuffler.io/docs) for detailed CORS configuration.

---

## Next Steps

Once connected, explore:

- **[Incidents](/incidents)** — View and manage security incidents
- **[Templates](/templates)** — Build reusable incident templates
- **[Custom Fields](/incidents/custom-fields)** — Configure custom fields for incidents

For API details, see the [Shuffle API Documentation](https://shuffler.io/docs/API).
