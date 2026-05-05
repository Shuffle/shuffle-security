<div align="center">

<img src="src/assets/singul-agent-icon.png" alt="Shuffle Security Agent" width="96" height="96" />

# Shuffle Security

[Shuffle Security](https://security.shuffler.io) is the open source incident response and security operations frontend for [Shuffle](https://shuffler.io) — built for and by security professionals. It brings alerts, cases, observables, assets and AI-driven response into a single workspace, designed to work well for SOC teams, MSSPs and service providers.

[_Key Features_](https://shuffler.io/docs/features) — [_Community & Support_](https://discord.gg/B2CBzUm) — [_Documentation_](https://shuffler.io/docs) — [_Getting Started_](https://shuffler.io/docs/getting_started) — [_Set up a demo call_](https://shuffler.io/contact)

Follow us on Twitter at [@shuffleio](https://twitter.com/shuffleio).

</div>

<p align="center">
  <img width="49%" alt="Incidents view" src="https://github.com/user-attachments/assets/6f8fef8e-83f2-4912-b14a-981ffca7980f" />
  <img width="49%" alt="Incident detail" src="https://github.com/user-attachments/assets/2c0056c2-646b-431b-a78d-7a2673fd1a3b" />
</p>

<p align="center">
  <img width="49%" alt="Automation pipeline" src="https://github.com/user-attachments/assets/e79ae7af-0db8-4d89-be62-706c223b198a" />
  <img width="49%" alt="AI Agent" src="https://github.com/user-attachments/assets/511cedd8-0a40-4e52-93cc-5638048a45dd" />
</p>

<div align="center">

## Try it

</div>

* Cloud: Register at [https://shuffler.io/register](https://shuffler.io/register) and get cooking
* Self-hosted: Check out the [installation guide](https://github.com/shuffle/shuffle/blob/master/.github/install-guide.md)
* Hosted UI: [https://security.shuffler.io](https://security.shuffler.io)

Please consider [sponsoring](https://github.com/sponsors/frikky) the project if you want to see more rapid development.

## Support
* [Discord](https://discord.gg/B2CBzUm)
* [Twitter](https://twitter.com/shuffleio)
* [Email](mailto:support@shuffler.io)
* [Open issue](https://github.com/shuffle/shuffle-security/issues/new)
* [Shuffler.io](https://shuffler.io/contact)

## Documentation
[Documentation](https://shuffler.io/docs) can be found on [https://shuffler.io/docs](https://shuffler.io/docs) and is written here: [https://github.com/shuffle/shuffle-docs](https://github.com/shuffle/shuffle-docs).

### Setting up a local development environment

```bash
npm install
npm run dev
```

Configure the API target via a `.env` file in the project root:

```env
VITE_SHUFFLE_API_URL=https://shuffler.io
```

See the [Setup Guide](/docs/setup) for detailed configuration instructions.

## Related repositories
* Shuffle (core platform): [https://github.com/shuffle/shuffle](https://github.com/shuffle/shuffle)
* OpenAPI apps: [https://github.com/shuffle/security-openapis](https://github.com/shuffle/security-openapis)
* Documentation: [https://github.com/shuffle/shuffle-docs](https://github.com/shuffle/shuffle-docs)
* Workflows: [https://github.com/shuffle/shuffle-workflows](https://github.com/shuffle/shuffle-workflows)
* Python apps: [https://github.com/shuffle/python-apps](https://github.com/shuffle/python-apps)

## Features
* Unified Incidents view (OCSF 2005) for alerts and cases
* Observables, assets and IOC correlation with threat intel enrichment
* AI Agent for triage, response suggestions and approvals
* Automation pipelines for ingest and forwarding
* Multi-tenant / sub-organization support for MSSPs
* 3,000+ integrations via the Apps catalog

## Tech Stack
* **React 18** with TypeScript
* **Vite** for build tooling
* **Material UI** + **Tailwind CSS** for styling
* **React Router** for navigation
* **Framer Motion** for animations

## Website
[https://shuffler.io](https://shuffler.io)

## Contributing
We want to make the world of cybersecurity more accessible and need all the help we can get. Send an email to [support@shuffler.io](mailto:support@shuffler.io) and we will make sure to give you any training you may need.

These are the main areas to contribute in:
* Frontend (ReactJS / TypeScript)
* App Creation (Python & GUI w/OpenAPI)
* Documentation (Markdown)
* Workflow creation (GUI & Conceptualizing)
* Content Creation (Blogs, videos etc)

Contributing guidelines are outlined [here](https://github.com/shuffle/Shuffle/blob/master/.github/CONTRIBUTING.md).

## Contributors
**Shuffle**

[![](https://contrib.rocks/image?repo=shuffle/shuffle)](https://github.com/shuffle/shuffle/graphs/contributors)

[**App magicians**](https://github.com/shuffle/shuffle-apps)

[![](https://contrib.rocks/image?repo=shuffle/shuffle-apps)](https://github.com/shuffle/shuffle-apps/graphs/contributors)

## License
All modular information related to Shuffle will be under MIT (anyone can use it for whatever purpose), with the Shuffle backend itself using AGPLv3.

* Workflows: MIT
* Documentation: MIT
* Shuffle backend: AGPLv3
* Apps, specification and App SDK: MIT
* Shuffle Security (this repo): MIT

## Project Structure
```
├── src/                    # Application source code
│   ├── components/         # Reusable UI components
│   ├── config/             # Configuration files
│   ├── context/            # React context providers
│   ├── docs/               # Markdown documentation files
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   ├── pages/              # Page components
│   └── theme/              # Theme configuration
├── public/                 # Static assets
└── [config files]          # Build tool configs (required at root)
```
