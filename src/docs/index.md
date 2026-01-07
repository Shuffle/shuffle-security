# Shuffle Cases Documentation

Welcome to the Shuffle Cases documentation. This guide will help you understand how to set up and use Shuffle Cases with your Shuffle Automation instance.

## Quick Links

- [Setup Guide](/docs/setup) - Configure Shuffle Cases to connect to your Shuffle backend
- [Shuffle API Documentation](https://shuffler.io/docs/API) - Complete API reference

## What is Shuffle Cases?

Shuffle Cases is a case management interface designed to work with [Shuffle Automation](https://shuffler.io). It provides:

- **Alert Management** - View, triage, and manage security alerts from your automation workflows
- **Case Tracking** - Create and track investigation cases with full audit trails
- **Template System** - Build reusable case templates for consistent incident response

## Getting Started

1. **Have a Shuffle Instance** - You need access to either Shuffle Cloud or a self-hosted Shuffle Automation instance
2. **Configure the Connection** - Point Shuffle Cases to your Shuffle backend URL
3. **Authenticate** - Use your Shuffle credentials to log in

See the [Setup Guide](/docs/setup) for detailed configuration instructions.

## Architecture

```
┌─────────────────┐     ┌─────────────────────┐
│  Shuffle Cases  │────▶│  Shuffle Automation │
│   (Frontend)    │◀────│     (Backend)       │
└─────────────────┘     └─────────────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │  Your Data  │
                        │  & Workflows│
                        └─────────────┘
```

Shuffle Cases is a frontend application that communicates with the Shuffle Automation API. All data is stored and processed by your Shuffle instance.
