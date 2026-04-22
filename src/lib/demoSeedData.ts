/**
 * Static fixtures used by Demo Mode.
 *
 * Each builder returns a discrete batch so the Demo can drip data in
 * progressively as the user lands on each tour step (instead of seeding
 * everything upfront).
 *
 * Every item is tagged with `metadata.extensions.custom_attributes.demo = true`
 * so cleanup can find orphans even if the local key index is lost.
 */

import type { OCSFIncidentFinding } from '@/config/ocsfIncidentSchema';
import type { OCSFDeviceInventory } from '@/config/ocsfAssetSchema';

export const DEMO_FLAG_KEY = 'shuffle_demo_seeded_keys';
export const DEMO_ACTIVE_KEY = 'shuffle_demo_active';
export const DEMO_SEEDED_STEPS_KEY = 'shuffle_demo_seeded_steps';

const now = () => Date.now();
const hoursAgo = (h: number) => new Date(now() - h * 3600 * 1000).toISOString();
const minsAgo = (m: number) => new Date(now() - m * 60 * 1000).toISOString();

/**
 * Generate a fresh, unique OCSF finding_uid for a demo incident. Combines a
 * short random suffix with the current unix timestamp (ms) so two seedings
 * within the same tick still get distinct ids.
 */
let __findingUidCounter = 0;
const generateDemoFindingUid = (): string => {
  __findingUidCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `demo-${now()}-${__findingUidCounter}-${rand}`;
};

const demoMeta = (uid: string) => ({
  uid,
  extensions: {
    custom_attributes: {
      demo: true,
    },
  },
});

type RawInc = {
  _key: string;
  title: string;
  desc: string;
  severity_id: number;
  severity: string;
  status_id: number;
  status: string;
  product: { name: string };
  first_seen_time: string;
  types: string[];
  /** Shared values surface in the Correlations panel — keep these consistent across linked incidents. */
  observables?: { type: string; value: string }[];
};

const toIncident = (item: RawInc): { key: string; value: OCSFIncidentFinding } => {
  // NOTE: Observables are intentionally NOT seeded directly on the incident
  // anymore. The incident lands "raw" with no enrichments; a background
  // process (see `enrichDemoIncidentObservables` in services/demoMode.ts)
  // adds them dynamically a few seconds after the incident is written, so
  // the timeline reads as "incident landed → Shuffle analysed it and
  // surfaced observables seconds later". The pending observables are
  // returned via `pendingObservables` (see toIncidentWithPending below) so
  // the seeder can schedule the background enrichment.
  return {
    key: item._key,
    value: {
      class_uid: 2005,
      class_name: 'Incident Finding',
      finding_uid: item._key,
      title: item.title,
      desc: item.desc,
      severity_id: item.severity_id,
      severity: item.severity,
      status_id: item.status_id,
      status: item.status,
      confidence: 75,
      created_time: item.first_seen_time,
      first_seen_time: item.first_seen_time,
      last_seen_time: item.first_seen_time,
      types: item.types,
      product: item.product,
      enrichments: [],
      metadata: {
        ...demoMeta(item._key),
        extensions: {
          custom_attributes: {
            ...(demoMeta(item._key).extensions.custom_attributes),
          },
        },
      },
    } as OCSFIncidentFinding & { enrichments: { type: string; value: string; first_seen: string; last_seen: string }[] },
  };
};

/**
 * Wrapper around `toIncident` that also returns the observables that should
 * be added in the background after the incident lands. Used by the demo
 * seeders to kick off the dynamic enrichment process.
 */
export type PendingObservable = { type: string; value: string };
export const toIncidentWithPending = (item: RawInc): {
  key: string;
  value: OCSFIncidentFinding;
  pendingObservables: PendingObservable[];
} => {
  const built = toIncident(item);
  return {
    ...built,
    pendingObservables: (item.observables || []).map(o => ({ type: o.type, value: o.value })),
  };
};

// ─── Incidents ────────────────────────────────────────────────────────────────
// Demo narrative (the "phishing → host compromise" funnel):
//   1. Sarah Chen reports a phishing email and admits she clicked the link.
//   2. Wazuh fires on her laptop FIN-LAPTOP-04 minutes later — Sliver implant
//      beaconing out, spawned by chrome.exe (her outdated Chrome was
//      vulnerable to CVE-2024-5274, a V8 type-confusion RCE).
// Sliver (Bishop Fox, Go) is now the most-observed real-world C2 framework
// per Microsoft TI / Vectra / Bishop Fox 2025-26 reporting — it's overtaken
// Cobalt Strike for both red-team and live-intrusion telemetry, so a Wazuh
// rule firing on a Sliver implant is a realistic 2026 detection.
// Both incidents share the same user, hostname, attacker IP and URL so the
// Correlations panel links them automatically and the agent knows to focus
// on isolating FIN-LAPTOP-04.
const PHISH_USER_EMAIL = 'sarah.chen@example.com';
const PHISH_HOST = 'FIN-LAPTOP-04';
const PHISH_ATTACKER_IP = '185.220.101.47';
const PHISH_LURE_URL = 'https://it-support-portal[.]live/mfa-reset?u=schen';
const PHISH_PAYLOAD_SHA256 = '7b1c4f9a2e3d8b6f1a0c5d7e9b2a4c6e8d1f3a5b7c9e1d2f4a6b8c0e2d4f6a8b';

// Diego Ruiz is the colleague who reports the phishing email — same Finance
// department as Sarah Chen. He noticed Sarah received the same email and
// flagged it; only Sarah actually clicked the link, which is what makes the
// later Wazuh detection on FIN-LAPTOP-04 the critical follow-up.
const PHISH_REPORTER_NAME = 'Diego Ruiz';
const PHISH_REPORTER_EMAIL = 'diego.ruiz@example.com';

/**
 * Single "focus" incident — a phishing email reported by Diego Ruiz (Finance)
 * who noticed his colleague Sarah Chen received the same lure. Source is
 * Outlook Office365. This is the centerpiece of the demo narrative; the
 * Wazuh / Sliver C2 detection on Sarah's laptop arrives later as the user
 * is exploring this incident.
 */
export const buildDemoFocusIncident = (): {
  key: string;
  value: OCSFIncidentFinding;
  pendingObservables: PendingObservable[];
} => {
  const t = now();
  return toIncidentWithPending({
    _key: `demo-inc-phish-${t}-focus`,
    title: `Phishing email reported by ${PHISH_REPORTER_NAME}`,
    desc: `From: ${PHISH_REPORTER_NAME} <${PHISH_REPORTER_EMAIL}>
To: phishing@example.com
Subject: FW: [SUSPICIOUS] IT Support — Action required: reset your MFA
Date: ${new Date(now()).toUTCString()}

Hi security team,

Forwarding the email below — it looks like a phishing attempt impersonating IT support. I did not click the link.

I also noticed my colleague Sarah Chen (Finance Analyst) received the exact same message. I have not been able to confirm yet whether she clicked it. Could you take a look?

Thanks,
Diego Ruiz
Senior Accountant, Finance

---------- Forwarded message ----------
From: IT Support <it-support@itsupport-portal.live>
To: ${PHISH_REPORTER_EMAIL}
Subject: [Action required] Reset your MFA within 24 hours
Date: ${new Date(now() - 14 * 60 * 1000).toUTCString()}

Dear user,

Our records indicate that your multi-factor authentication enrollment is out of date. To avoid losing access to your account, please reset your MFA within the next 24 hours by visiting the secure portal below:

  ${PHISH_LURE_URL}

If you do not complete this step, your account will be temporarily suspended.

Thank you,
IT Support Team`,
    severity_id: 4, severity: 'High', status_id: 1, status: 'New',
    product: { name: 'outlook_office365' },
    first_seen_time: minsAgo(0),
    types: ['phishing'],
    observables: [
      { type: 'email', value: PHISH_REPORTER_EMAIL },
      { type: 'email', value: PHISH_USER_EMAIL },
      { type: 'url', value: PHISH_LURE_URL },
      { type: 'ip', value: PHISH_ATTACKER_IP },
    ],
  });
};

/**
 * The follow-up Wazuh / Sliver C2 implant detection on FIN-LAPTOP-04. This
 * arrives after the user has spent some time exploring the phishing
 * incident — confirming that Sarah did click the link and that her outdated
 * Chrome (CVE-2024-5274) was exploited. Source is Wazuh.
 */
export const buildDemoWazuhImplantIncident = (): {
  key: string;
  value: OCSFIncidentFinding;
  pendingObservables: PendingObservable[];
} => {
  const t = now();
  return toIncidentWithPending({
    _key: `demo-inc-malware-${t}-wazuh`,
    title: `Sliver C2 implant beaconing on ${PHISH_HOST}`,
    desc: `Wazuh agent flagged an unsigned Go binary at %APPDATA%\\Roaming\\Microsoft\\Edge\\msedge_proxy.exe on ${PHISH_HOST} (owner: Sarah Chen) making low-and-slow HTTPS callbacks to ${PHISH_ATTACKER_IP} every ~57s with jitter — Sliver implant signature (rule 100221, level 12). Process tree: chrome.exe (v124.0.6367.91 — outdated, vulnerable to CVE-2024-5274) → cmd.exe → msedge_proxy.exe, triggered after the user visited ${PHISH_LURE_URL}. Sysmon EID 1 + 3 correlated; persistence created via Run key "EdgeUpdate".`,
    severity_id: 5, severity: 'Critical', status_id: 1, status: 'New',
    product: { name: 'Wazuh' },
    first_seen_time: minsAgo(0),
    types: ['malware', 'c2', 'exploit'],
    observables: [
      { type: 'hostname', value: PHISH_HOST },
      { type: 'email', value: PHISH_USER_EMAIL },
      { type: 'ip', value: PHISH_ATTACKER_IP },
      { type: 'url', value: PHISH_LURE_URL },
      { type: 'sha256', value: PHISH_PAYLOAD_SHA256 },
      { type: 'cve', value: 'CVE-2024-5274' },
      { type: 'tool_name', value: 'Sliver' },
    ],
  });
};

export const buildDemoIncidentsBatch1 = (): { key: string; value: OCSFIncidentFinding }[] => {
  const t = now();
  return ([
    {
      _key: `demo-inc-phish-${t}-1`,
      title: 'Phishing email reported by Sarah Chen',
      desc: `User reported a suspicious email impersonating IT support, asking to reset MFA. She admits she clicked the link from her ${PHISH_HOST} laptop before flagging the message. URL resolves to a known credential-harvesting kit hosted at ${PHISH_ATTACKER_IP}.`,
      severity_id: 4, severity: 'High', status_id: 2, status: 'In Progress',
      product: { name: 'Microsoft Defender for Office 365' },
      first_seen_time: minsAgo(38),
      types: ['phishing', 'credential-theft'],
      observables: [
        { type: 'email', value: PHISH_USER_EMAIL },
        { type: 'hostname', value: PHISH_HOST },
        { type: 'url', value: PHISH_LURE_URL },
        { type: 'ip', value: PHISH_ATTACKER_IP },
      ],
    },
    {
      _key: `demo-inc-malware-${t}-2`,
      title: `Sliver C2 implant beaconing on ${PHISH_HOST}`,
      desc: `Wazuh agent flagged an unsigned Go binary at %APPDATA%\\Roaming\\Microsoft\\Edge\\msedge_proxy.exe on ${PHISH_HOST} (owner: Sarah Chen) making low-and-slow HTTPS callbacks to ${PHISH_ATTACKER_IP} every ~57s with jitter — Sliver implant signature (rule 100221, level 12). Process tree: chrome.exe (v124.0.6367.91 — outdated, vulnerable to CVE-2024-5274) → cmd.exe → msedge_proxy.exe, triggered after the user visited ${PHISH_LURE_URL}. Sysmon EID 1 + 3 correlated; persistence created via Run key "EdgeUpdate".`,
      severity_id: 5, severity: 'Critical', status_id: 1, status: 'New',
      product: { name: 'Wazuh' },
      first_seen_time: minsAgo(12),
      types: ['malware', 'c2', 'exploit'],
      observables: [
        { type: 'hostname', value: PHISH_HOST },
        { type: 'email', value: PHISH_USER_EMAIL },
        { type: 'ip', value: PHISH_ATTACKER_IP },
        { type: 'url', value: PHISH_LURE_URL },
        { type: 'sha256', value: PHISH_PAYLOAD_SHA256 },
        { type: 'cve', value: 'CVE-2024-5274' },
        { type: 'tool_name', value: 'Sliver' },
      ],
    },
  ] as RawInc[]).map(toIncident);
};

// Optional follow-up batch — adds one more incident if the user lingers.
export const buildDemoIncidentsBatch2 = (): { key: string; value: OCSFIncidentFinding }[] => {
  const t = now();
  return ([
    {
      _key: `demo-inc-login-${t}-3`,
      title: 'Impossible travel: Anna Park (Oslo → Lagos in 14 min)',
      desc: 'Successful Azure AD sign-in from Lagos, Nigeria 14 minutes after a successful sign-in from Oslo, Norway. MFA satisfied via push approval.',
      severity_id: 4, severity: 'High', status_id: 1, status: 'New',
      product: { name: 'Microsoft Defender for Office 365' },
      first_seen_time: minsAgo(54),
      types: ['identity', 'impossible-travel'],
      observables: [
        { type: 'email', value: 'anna.park@example.com' },
      ],
    },
  ] as RawInc[]).map(toIncident);
};

// ─── Assets ───────────────────────────────────────────────────────────────────
export const buildDemoAssets = (): { key: string; value: OCSFDeviceInventory }[] => {
  const t = now();
  const list = [
    { hostname: 'FIN-LAPTOP-04', type_id: 3, type: 'Laptop', ip: '10.4.21.18', risk_level_id: 4, risk_level: 'Critical', risk_score: '94', owner: { name: 'Sarah Chen', email: 'sarah.chen@example.com' }, os: 'Windows 11 Pro' },
    { hostname: 'FIN-DT-11', type_id: 2, type: 'Desktop', ip: '10.4.10.55', risk_level_id: 3, risk_level: 'High', risk_score: '78', owner: { name: 'Diego Ruiz', email: 'diego.ruiz@example.com' }, os: 'Windows 11 Pro' },
    { hostname: 'FS-CORP-02', type_id: 1, type: 'Server', ip: '10.4.1.12', risk_level_id: 4, risk_level: 'Critical', risk_score: '88', owner: { name: 'IT Operations', email: 'itops@example.com' }, os: 'Windows Server 2022' },
    { hostname: 'DC-OSL-01', type_id: 1, type: 'Server', ip: '10.4.1.2', risk_level_id: 2, risk_level: 'Medium', risk_score: '42', owner: { name: 'Identity Team', email: 'identity@example.com' }, os: 'Windows Server 2022 (Domain Controller)' },
    { hostname: 'aws-prod-web-03', type_id: 6, type: 'Virtual', ip: '10.20.4.31', risk_level_id: 2, risk_level: 'Medium', risk_score: '38', owner: { name: 'Platform Team', email: 'platform@example.com' }, os: 'Ubuntu 22.04' },
    { hostname: 'CFO-IPHONE', type_id: 5, type: 'Mobile', ip: '10.4.50.7', risk_level_id: 3, risk_level: 'High', risk_score: '67', owner: { name: 'Mark Olsen', email: 'mark.olsen@example.com' }, os: 'iOS 17.4' },
  ];

  return list.map((d, i) => {
    const uid = `demo-asset-${t}-${i}`;
    return {
      key: uid,
      value: {
        hostname: d.hostname,
        type_id: d.type_id,
        type: d.type,
        ip: d.ip,
        uid,
        risk_level_id: d.risk_level_id,
        risk_level: d.risk_level,
        risk_score: d.risk_score,
        owner: d.owner,
        first_seen_time: hoursAgo(24 * 30),
        last_seen_time: minsAgo(5 + i * 7),
        desc: d.os,
        metadata: demoMeta(uid),
      } as OCSFDeviceInventory,
    };
  });
};

// ─── Users (stakeholder registry) ─────────────────────────────────────────────
export const buildDemoUsers = (): { key: string; value: object }[] => {
  const t = now();
  const list = [
    { name: 'Sarah Chen', email: 'sarah.chen@example.com', role: 'Finance Analyst', department: 'Finance' },
    { name: 'Diego Ruiz', email: 'diego.ruiz@example.com', role: 'Senior Accountant', department: 'Finance' },
    { name: 'Anna Park', email: 'anna.park@example.com', role: 'Sales Director', department: 'Sales' },
    { name: 'Mark Olsen', email: 'mark.olsen@example.com', role: 'CFO', department: 'Executive' },
    { name: 'Jessica Lopez', email: 'j.lopez@example.com', role: 'Customer Success Manager (departing)', department: 'CS' },
  ];

  return list.map((u, i) => {
    const key = `demo-user-${t}-${i}-${u.email.split('@')[0]}`;
    return {
      key,
      value: {
        ...u,
        uid: key,
        created_at: hoursAgo(24 * 90),
        metadata: demoMeta(key),
      },
    };
  });
};

// ─── Vulnerabilities ──────────────────────────────────────────────────────────
// One real, scary CVE wired to the same host (FIN-LAPTOP-04) the phishing →
// CrowdStrike narrative pivots on. CVE-2024-5274 was an in-the-wild zero-day
// V8 type-confusion bug enabling RCE via a crafted HTML page — exactly the
// kind of thing a phishing link would weaponise.
//
// We use the OSV-style record shape that useVulnerabilities.ts parses:
//   { id, summary, details, severity[], database_specific, affected[], hosts[] }
export const buildDemoVulnerabilities = (): { key: string; value: object }[] => {
  const t = now();
  const key = `demo-vuln-${t}-cve-2024-5274`;
  return [
    {
      key,
      value: {
        id: 'CVE-2024-5274',
        summary: 'Google Chrome V8 Type Confusion (RCE) — CVE-2024-5274',
        details:
          'Type confusion in V8 in Google Chrome prior to 125.0.6422.112 allowed a remote attacker to execute arbitrary code inside a sandbox via a crafted HTML page. Exploited in the wild as a zero-day (Google TAG, May 2024). FIN-LAPTOP-04 is running Chrome 124.0.6367.91 — vulnerable.',
        aliases: ['CVE-2024-5274'],
        published: hoursAgo(24 * 60),
        modified: hoursAgo(24 * 14),
        severity: [{ type: 'CVSS_V3', score: '8.8' }],
        database_specific: { severity: 'High' },
        affected: [
          {
            package: { ecosystem: 'Chromium', name: 'google-chrome' },
            ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '125.0.6422.112' }] }],
          },
        ],
        references: [
          { type: 'ADVISORY', url: 'https://nvd.nist.gov/vuln/detail/CVE-2024-5274' },
          { type: 'WEB', url: 'https://chromereleases.googleblog.com/2024/05/stable-channel-update-for-desktop_23.html' },
        ],
        hosts: [
          {
            hostname: 'FIN-LAPTOP-04',
            paths: [
              { path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', version: '124.0.6367.91', last_seen: minsAgo(8) },
            ],
          },
        ],
        metadata: demoMeta(key),
      },
    },
  ];
};

