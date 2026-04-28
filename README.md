# Shuffle Security

A security operations platform for managing alerts, cases, and incident response workflows.

## Project Structure

```
├── src/                    # Application source code
│   ├── components/         # Reusable UI components
│   │   ├── auth/           # Authentication components
│   │   ├── docs/           # Documentation components
│   │   ├── landing/        # Landing page sections
│   │   ├── layout/         # Layout components (sidebar, header)
│   │   └── ui/             # Base UI components (shadcn/ui)
│   ├── config/             # Configuration files
│   ├── context/            # React context providers
│   ├── docs/               # Markdown documentation files
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   ├── pages/              # Page components
│   │   ├── dashboard/      # Dashboard pages
│   │   └── docs/           # Documentation pages
│   └── theme/              # Theme configuration
├── public/                 # Static assets
└── [config files]          # Build tool configs (required at root)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Environment Variables

Create a `.env` file in the project root and configure:

```env
VITE_SHUFFLE_API_URL=https://shuffler.io
```

See the [Setup Guide](/docs/setup) for detailed configuration instructions.

## API Integration

This application connects to external APIs for:

- **Authentication** - Login via credentials
- **Alerts** - Fetch and manage security alerts
- **Cases** - Create and track incident cases
- **Workflows** - Trigger automated response actions

## Tech Stack

- **React 18** with TypeScript
- **Vite** for build tooling
- **Material UI** for components
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Framer Motion** for animations

## License

MIT