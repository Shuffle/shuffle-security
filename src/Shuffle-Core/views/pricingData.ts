// @ts-nocheck
// Pricing plans and features data
// This file contains all static data for the pricing page

export const openSourcePlan = {
  type: "Open Source",
  title: "Free",
  subtitle: "Start automating right way with most features.",
  price: "Free",
  isRecommended: false,
  buttonText: "Set up Shuffle",
  exclusive: {
    title: "Pricing Model for Open Source:",
    features: [
      {
        text: "License — Custom App Runs",
        tooltip: "Shuffle License is based on app-runs or usage of the platform"
      },
      {
        text: "Support — Community Level",
        tooltip: "Access our [Discord](https://discord.gg/shuffle) to get help from fellow community members"
      },
      {
        text: "Onboarding — Docs based",
      }
    ],
  },
  features: [
    "1 Hour Workflow Run History",
    "1 Hour Workflow Backup",
    "1 Tenants",
    "1 Environments",
    "1 User",
    "Custom Workflows",
    "All 2500+ Apps",
    "All Usecase Templates",
    "No Internet usage",
  ],
  additionalText: "Includes: ",
};

export const pricingPlansData = [
  {
    type: "Starter",
    title: "Free Trial",
    subtitle: "Start automating right away with 2k App-Runs per month for free.",
    price: "Free",
    isRecommended: false,
    buttonText: "Start for Free", // This will be dynamically updated based on login status
    exclusive: {
      title: "Pricing Model for Starter:",
      features: [
        {
          text: "License — 2k App-Runs per month",
          tooltip: "Shuffle License is based on app-runs or usage of the platform."
        },
        {
          text: "Support — Community Level",
          tooltip: "Access our [Discord](https://discord.gg/shuffle) to get help from fellow community members"
        },
        {
          text: "Onboarding — Docs based",
        }
      ],
    },
    features: [
       "1 Day workflow run history",
      "7 Days workflow backup",
      "1 Tenant",
      "1 Environment",
      "5 Users",
      "10 Workflows",
      "Airgap support",
      "All 2500+ Apps",
      "All Security Usecase Templates",
    ],
    additionalText: "Includes: ",
  },
  {
    type: "Scale",
    title: "$29",
    subtitle: "Scale your automation needs with extra features and higher limits.",
    price: 32, // Base price before discount calculation
    isRecommended: false,
    buttonText: "Select Plan",
    exclusive: {
      title: "Pricing Model for Scale:",
      features: [
        {
          text: "License — 10k App-Runs per month",
          tooltip: "Shuffle License is based on app-runs or usage of the platform."
        },
        {
          text: "Support — Community Level",
          tooltip: "Access our [Discord](https://discord.gg/shuffle) to get help from fellow community members"
        },
        {
          text: "Onboarding — Docs based",
        }
      ],
    },
    features: [
      "30 Days workflow run history",
      "14 Days workflow backup",
      "3 Tenants",
      "2 Environments",
      "15 Users",
      "25 Workflows",
      "Select Datacenter Region",
    ],
    additionalText: "Everything in Starter, plus:",
  },
  {
    type: "Enterprise",
    title: "Let's Talk!",
    subtitle: "Perfect for businesses that want to elevate their automation and security processes.",
    price: "Let's Talk!",
    isRecommended: false,
    buttonText: "Contact Us",
    exclusive: {
      title: "Pricing Model for Enterprise:",
      features: [
        {
          text: "License — Custom App-Runs",
          tooltip: "Shuffle License is based on app-runs or usage of the platform."
        },
        {
          text: "Support — Standard or Enterprise Level",
          tooltip: "Standard Support includes Email with SLA. Enterprise Support includes Email with SLA, onCall, Professional Services, and Alert Mechanism."
        },
        {
          text: "Onboarding — Full Set-Up with Shuffle",
        }
      ],
    },
    features: {
      Cloud: [
        "365+ Day Workflow Run History",
        "∞ Days Workflow Backup",
        "∞ Tenants",
        "∞ Environments",
        "∞ Users",
        "∞ Workflows",
        "Critical Response",
        "On-Call Support",
        "Setup and Maintenance",
        "Key Management System",
        "Custom Integrations",
        "Custom Scaling Options",
        "Billing and Invoice Included",
        "Custom Contract",
      ],
      SelfHosted: [
        "∞ Days Workflow Run History",
        "∞ Days Workflow Backup",
        "∞ Tenants",
        "∞ Environments",
        "∞ Users",
        "∞ Workflows",
        "Air Gap Possible",
        "Critical Response",
        "On-Call Support",
        "Setup and Maintenance",
        "Key Management System",
        "Custom Integrations",
        "Custom Scaling Options",
        "Billing and Invoice Included",
        "Custom Contract",
      ],
    },
    additionalText: "Everything in Starter and Scale, plus:",
  },
];

// All features data
export const featuresData = [
  {
    title: "Core Features",
    features: [
      {
        name: "Premier Workflow Editor",
        includedIn: [
          {
            plan: "Open Source",
            status: true,
          },
          {
            plan: "Starter",
            status: true,
          },
          {
            plan: "Scale",
            status: true,
          },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Premier App Editor",
        includedIn: [
          {
            plan: "Open Source",
            status: true,
          },
          {
            plan: "Starter",
            status: true,
          },
          {
            plan: "Scale",
            status: true,
          },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "All 2500+ Apps",
        includedIn: [
          {
            plan: "Open Source",
            status: true,
          },
          {
            plan: "Starter",
            status: true,
          },
          {
            plan: "Scale",
            status: true,
          },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Private Apps",
        includedIn: [
          {
            plan: "Open Source",
            status: true,
          },
          {
            plan: "Starter",
            status: true,
          },
          {
            plan: "Scale",
            status: true,
          },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "All Usecase Templates",
        includedIn: [
          {
            plan: "Open Source",
            status: true,
          },
          {
            plan: "Starter",
            status: true,
          },
          {
            plan: "Scale",
            status: true,
          },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Autocomplete Features",
        includedIn: [
          {
            plan: "Open Source",
            status: true,
          },
          {
            plan: "Starter",
            status: true,
          },
          {
            plan: "Scale",
            status: true,
          },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Real Time Error Notification",
        includedIn: [
          {
            plan: "Open Source",
            status: true,
          },
          {
            plan: "Starter",
            status: true,
          },
          {
            plan: "Scale",
            status: true,
          },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Enterprise & Scale",
    features: [
      {
        name: "Tenants",
        includedIn: [
          { plan: "Open Source", status: 1},
          { plan: "Starter", status: 1 },
          { plan: "Scale", status: 3 },
          {
            plan: "Enterprise",
            status: {
              Cloud: "∞",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "Runtime Locations",
        includedIn: [
          { plan: "Open Source", status: 1 },
          { plan: "Starter", status: 1 },
          { plan: "Scale", status: 2 },
          {
            plan: "Enterprise",
            status: {
              Cloud: "∞",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "High Availability",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Environments",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
        description: "Test, Stag, Prod, etc.",
      },
      {
        name: "Datacenter Region Selection",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Multi-Tenant Workflows",
        includedIn: [
          { plan: "Open Source", status: "Limited" },
          { plan: "Starter", status: "Limited" },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Shuffle Datastore (Cache)",
        includedIn: [
          { plan: "Open Source", status: "Limited" },
          { plan: "Starter", status: "1 GB" },
          { plan: "Scale", status: "5 GB" },
          {
            plan: "Enterprise",
            status: {
              Cloud: "100+ GB",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "File Storage",
        includedIn: [
          { plan: "Open Source", status: "Limited" },
          { plan: "Starter", status: "1 GB" },
          { plan: "Scale", status: "5 GB" },
          {
            plan: "Enterprise",
            status: {
              Cloud: "100+ GB",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "SMS Alerting",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: "30" },
          { plan: "Scale", status: "75" },
          {
            plan: "Enterprise",
            status: {
              Cloud: "300+",
              "Self-Hosted": "300+",
            },
          },
        ],
      },
      {
        name: "Email Alerting",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: 100 },
          { plan: "Scale", status: 500 },
          {
            plan: "Enterprise",
            status: {
              Cloud: "10000+",
              "Self-Hosted": "10000+",
            },
          },
        ],
      },
      {
        name: "Organization Control",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Custom Integrations",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Custom Scaling Options",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Audit Logging",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Usage Tracking and Control",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Billing and Invoice",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Custom Contract",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Development",
    features: [
      {
        name: "Global Variables",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Code Executions",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "API Executions",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Shuffle Forms",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Triggers",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
        description: "Webhook, Event, Schedule, Email, and more.",
      },
      {
        name: "Workflows as Triggers",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Automation with Shuffle API",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Advanced Data Pipelines",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Powerful Ingest & Egress",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Custom Apps",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Workflow",
    features: [
      {
        name: "Number of Workflows",
        includedIn: [
          { plan: "Open Source", status: "∞" },
          { plan: "Starter", status: 10 },
          { plan: "Scale", status: 25 },
          {
            plan: "Enterprise",
            status: {
              Cloud: "∞",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "Max Workflow Run Time",
        includedIn: [
          { plan: "Open Source", status: "∞" },
          { plan: "Starter", status: "∞" },
          { plan: "Scale", status: "∞" },
          {
            plan: "Enterprise",
            status: {
              Cloud: "∞",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "Workflow Version Control",
        includedIn: [
          { plan: "Open Source", status: "∞" },
          { plan: "Starter", status: "∞" },
          { plan: "Scale", status: "∞" },
          {
            plan: "Enterprise",
            status: {
              Cloud: "∞",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "Number of Active Workflows",
        includedIn: [
          { plan: "Open Source", status: "∞" },
          { plan: "Starter", status: "∞" },
          { plan: "Scale", status: "∞" },
          {
            plan: "Enterprise",
            status: {
              Cloud: "∞",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "Concurrent Workflow Runs",
        includedIn: [
          { plan: "Open Source", status: "∞" },
          { plan: "Starter", status: "∞" },
          { plan: "Scale", status: "∞" },
          {
            plan: "Enterprise",
            status: {
              Cloud: "∞",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "Workflow Re-runs",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Workflow Run History Search",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Workflow Run History",
        includedIn: [
          { plan: "Open Source", status: "1 Hour" },
          { plan: "Starter", status: "1 Day" },
          { plan: "Scale", status: "30 Days" },
          {
            plan: "Enterprise",
            status: {
              Cloud: "365+ Days",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "Workflow Backup",
        includedIn: [
          { plan: "Open Source", status: "1 Hour" },
          { plan: "Starter", status: "7 Days" },
          { plan: "Scale", status: "14 Days" },
          {
            plan: "Enterprise",
            status: {
              Cloud: "∞",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "Hybrid Workflow Runs",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Security",
    features: [
      {
        name: "2 Factor Authentication",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "SSO / SAML",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Secret Key/Auth Encryption",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": "-",
            },
          },
        ],
      },
      {
        name: "Key Management System",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
        description:
          "Shuffle supports KMS and custom integrations",
      },
      {
        name: "Authentication Groups",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Sharing",
    features: [
      {
        name: "Users",
        includedIn: [
          { plan: "Open Source", status: 1 },
          { plan: "Starter", status: 5 },
          { plan: "Scale", status: 15 },
          {
            plan: "Enterprise",
            status: {
              Cloud: "∞",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
      {
        name: "Distributed User Management",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Admin Roles",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Default & Shared Workflows",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: "∞" },
          { plan: "Scale", status: "∞" },
          {
            plan: "Enterprise",
            status: {
              Cloud: "∞",
              "Self-Hosted": "∞",
            },
          },
        ],
      },
    ],
  },
  {
    title: "Support",
    features: [
      {
        name: "Community Support",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Standard Email Support",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Priority Support with SLA",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Setup and Maintenance",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Critical Response",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "On-Call Support",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
    ],
  },
  {
    title: "Additional Features",
    features: [
      {
        name: "Workflow Recommendations",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "AI Agents",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "AI Assistant",
        includedIn: [
          { plan: "Open Source", status: false },
          { plan: "Starter", status: false },
          { plan: "Scale", status: false },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Standardized App Categories",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "App Framework",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Hybrid App Synchronization",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Hybrid Search Engine",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Log Ingestion (Data Lake)",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
      {
        name: "Data Lake Searching (SIEM)",
        includedIn: [
          { plan: "Open Source", status: true },
          { plan: "Starter", status: true },
          { plan: "Scale", status: true },
          {
            plan: "Enterprise",
            status: {
              Cloud: true,
              "Self-Hosted": true,
            },
          },
        ],
      },
    ],
  },
];
