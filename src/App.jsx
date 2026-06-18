import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

// ── Domain config ─────────────────────────────────────────────────────────────
const ENGINEERS  = ["Priya Mehta", "James Okafor", "Sofia Reyes", "Vishal Arora", "Natalie Chen"];
const SLA_BY_TIER = { "Falcon Enterprise": 7, "Falcon Pro": 5, "Falcon Go": 3 }; // calendar days
const STATUSES   = ["Active", "Pending", "Under Review", "Failed"];
const TIERS      = ["Falcon Enterprise", "Falcon Pro", "Falcon Go"];
const REGIONS    = ["All Regions", "US-East", "US-West", "EU-West", "APAC"];

// Runbook steps per provisioning task
const RUNBOOK = {
  acc: [
    "Log in to Falcon Console → Support → Customer Tenants",
    "Click '+ New Tenant', enter company legal name, address, and POC email",
    "Assign provisioning engineer and account manager to the tenant record",
    "Confirm CID (Customer ID) is auto-generated (format: 32-char hex)",
    "Set tenant region to match data residency requirements (US-1 / EU-1 / US-GOV-1)",
    "Send CID + onboarding welcome email to customer POC via secure channel",
  ],
  sub: [
    "Open the customer tenant → Billing → Subscriptions → Manage",
    "Apply the contracted tier bundle: Falcon Go / Pro / Enterprise",
    "Add module SKUs from the contract line items (Identity, Discover, Spotlight, etc.)",
    "Confirm subscription status = 'Active' within the console (allow up to 5 min)",
    "Verify seat count matches the signed order form; raise discrepancy immediately",
    "Record CID, tier, seat count, and activation timestamp in the Jira provisioning ticket",
  ],
  sen: [
    "Navigate to Host Setup > Sensor Downloads, select OS flavors needed",
    "Generate a scoped installation token (set expiry: 7 days, group: Customer Onboarding)",
    "Package sensor installer(s) + token into a password-protected zip",
    "Deliver bundle to customer IT lead via 1Password Send or encrypted email only",
    "Guide customer through deployment: Windows (MSI/GPO), Linux (RPM/DEB), Mac (pkg/Jamf)",
    "Monitor Host Management; hosts should check in within 15 min of install",
    "Validate telemetry: run a test detection (EICAR or Mimikatz test) to confirm pipeline",
    "Confirm kernel extension (kext) approvals on macOS and AV exclusions on all platforms",
  ],
  cred: [
    "Console > Users > Invite User, set role: Falcon Administrator (scope: read/write)",
    "For SSO customers: configure SAML IdP in Authentication → SSO settings first",
    "Generate time-limited invite link (expires in 24h); never reuse old links",
    "Deliver link exclusively via approved secure channel (1Password / ProtonMail / encrypted Slack DM)",
    "Confirm customer: clicked link, set a strong password, and enabled MFA (TOTP or hardware key)",
    "For API access: create an OAuth2 API client (read scopes only), deliver client_id + secret securely",
    "Revoke all temporary provisioning tokens once customer confirms successful login",
  ],
  pol: [
    "Configuration → Prevention Policies → Clone the '[BASELINE] Customer Onboarding' template",
    "Rename policy to match customer company name + tier (e.g. 'Northrop-Enterprise-Prevention')",
    "Set enforcement mode: Alert Only for Week 1, switch to Prevention after customer sign-off",
    "Tune ML sensor detection level: Aggressive (Enterprise), Moderate (Pro), Conservative (Go)",
    "Enable process blocking exclusions for known customer software (AV, backup agents, dev tools)",
    "Apply Identity-based policy if ITD module is contracted (Configuration → Identity Protection)",
    "Assign the policy to the customer host group; confirm propagation in ~2 min",
    "Schedule a policy review call with customer Security team at Day 7 post-deployment",
  ],
  hand: [
    "Verify all 5 prior checklist steps are marked ✓ in the provisioning tracker",
    "Confirm sensor check-in rate ≥ 95% and zero P0/P1 unresolved detections",
    "Generate provisioning completion report: CID, seats, coverage %, TTP, escalation summary",
    "Book 30-min handoff call with CSM, share report, walkthrough Falcon console live",
    "Transfer Salesforce opportunity to 'Live Customer' record type, assign to CSM",
    "Create the customer's first scheduled Threat Hunting task in Falcon Overwatch",
    "Set Day-30 / Day-90 / QBR check-in dates in CSM calendar",
    "Close Jira provisioning epic; archive all provisioning artifacts in SharePoint",
  ],
};

// ── Customer data (enriched) ──────────────────────────────────────────────────
const INITIAL_CUSTOMERS = [
  {
    id: 1,
    company:      "Northrop Grumman Corporation",
    cid:          "CID-NGBI-A847F2",
    tier:         "Falcon Enterprise",
    industry:     "Defense & Aerospace",
    region:       "US-East",
    features:     ["Falcon Prevent", "Identity Threat Detection", "Threat Intelligence", "Falcon Fusion", "Falcon Discover"],
    status:       "Active",
    engineer:     "Priya Mehta",
    startDate:    "2024-06-10T09:00:00Z",
    lastUpdated:  "2024-06-14T10:22:00Z",
    completedDate:"2024-06-14T10:22:00Z",
    seats:        { licensed: 12500, deployed: 12500 },
    platforms:    { windows: 8400, linux: 3200, mac: 900, cloud: 480 },
    sensorVersion:"7.14.17004.0",
    policyMode:   "Prevention",
    sensorHealth: 99.7,
    detections:   { critical: 2, high: 8, medium: 16, total: 26 },
    integrations: [
      { name: "Splunk SIEM",        status: "Active" },
      { name: "ServiceNow ITSM",    status: "Active" },
      { name: "Falcon Fusion SOAR", status: "Active" },
      { name: "Palo Alto XSOAR",    status: "N/A" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)",             status: "Active" },
      { name: "Falcon Identity Threat Detection", status: "Active" },
      { name: "Falcon Intelligence",              status: "Active" },
      { name: "Falcon Fusion SOAR",               status: "Active" },
      { name: "Falcon Discover",                  status: "Active" },
      { name: "Falcon Spotlight",                 status: "N/A" },
    ],
    notes: "Customer uses Jamf for Mac management; sensor pushed via Jamf MDM profile. Linux servers provisioned via Ansible playbook provided by customer IT. API client (read-only) created for Splunk HEC integration. MFA enforced via Okta SSO.",
    escalations: [],
    checklist: [
      { id: "acc",  label: "Account Created",                  checked: true,  timestamp: "2024-06-10T09:00:00Z", engineer: "Priya Mehta" },
      { id: "sub",  label: "Subscription Tier Activated",      checked: true,  timestamp: "2024-06-10T10:30:00Z", engineer: "Priya Mehta" },
      { id: "sen",  label: "Endpoint Sensors Deployed",        checked: true,  timestamp: "2024-06-11T14:00:00Z", engineer: "Priya Mehta" },
      { id: "cred", label: "Admin Credentials Delivered",      checked: true,  timestamp: "2024-06-11T16:00:00Z", engineer: "Priya Mehta" },
      { id: "pol",  label: "Prevention Policy Configured",     checked: true,  timestamp: "2024-06-12T11:00:00Z", engineer: "Priya Mehta" },
      { id: "hand", label: "Handoff to Customer Success",      checked: true,  timestamp: "2024-06-14T10:22:00Z", engineer: "Priya Mehta" },
    ],
  },
  {
    id: 2,
    company:      "JPMorgan Chase & Co.",
    cid:          "CID-JPMC-C391D5",
    tier:         "Falcon Enterprise",
    industry:     "Financial Services",
    region:       "US-East",
    features:     ["Falcon Prevent", "Cloud Security", "Zero Trust Assessment", "Threat Intelligence"],
    status:       "Pending",
    engineer:     "James Okafor",
    startDate:    "2024-06-14T09:00:00Z",
    lastUpdated:  "2024-06-15T08:45:00Z",
    completedDate: null,
    seats:        { licensed: 28000, deployed: 11900 },
    platforms:    { windows: 9200, linux: 2400, mac: 300, cloud: 1240 },
    sensorVersion:"7.14.17004.0",
    policyMode:   "Alert Only",
    sensorHealth: 91.4,
    detections:   { critical: 0, high: 3, medium: 7, total: 10 },
    integrations: [
      { name: "Splunk SIEM",        status: "Pending" },
      { name: "ServiceNow ITSM",    status: "Active" },
      { name: "Falcon Fusion SOAR", status: "Pending" },
      { name: "AWS Security Hub",   status: "Pending" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)",             status: "Active" },
      { name: "Falcon Cloud Security (CWP)",      status: "Pending" },
      { name: "Falcon Zero Trust Assessment",     status: "Pending" },
      { name: "Falcon Intelligence",              status: "Active" },
      { name: "Falcon Discover",                  status: "Pending" },
      { name: "Falcon Identity Threat Detection", status: "Pending" },
    ],
    notes: "Large-scale deployment, phased rollout across 3 datacenters. AWS cloud workloads require CrowdStrike Cloud Security agent (separate token). Splunk integration blocked pending customer network ACL change (ticket: JIRA-4421). Policy switch to Prevention pending CISO sign-off.",
    escalations: [],
    checklist: [
      { id: "acc",  label: "Account Created",              checked: true,  timestamp: "2024-06-14T09:00:00Z", engineer: "James Okafor" },
      { id: "sub",  label: "Subscription Tier Activated",  checked: true,  timestamp: "2024-06-14T11:00:00Z", engineer: "James Okafor" },
      { id: "sen",  label: "Endpoint Sensors Deployed",    checked: false, timestamp: null, engineer: null },
      { id: "cred", label: "Admin Credentials Delivered",  checked: false, timestamp: null, engineer: null },
      { id: "pol",  label: "Prevention Policy Configured", checked: false, timestamp: null, engineer: null },
      { id: "hand", label: "Handoff to Customer Success",  checked: false, timestamp: null, engineer: null },
    ],
  },
  {
    id: 3,
    company:      "Lockheed Martin Corporation",
    cid:          "CID-LKMT-B217E8",
    tier:         "Falcon Pro",
    industry:     "Defense & Aerospace",
    region:       "US-East",
    features:     ["Falcon Prevent", "Threat Intelligence", "Falcon Spotlight"],
    status:       "Under Review",
    engineer:     "Sofia Reyes",
    startDate:    "2024-06-13T09:00:00Z",
    lastUpdated:  "2024-06-15T13:10:00Z",
    completedDate: null,
    seats:        { licensed: 8700, deployed: 4100 },
    platforms:    { windows: 3800, linux: 290, mac: 10, cloud: 0 },
    sensorVersion:"7.13.16803.0",
    policyMode:   "Alert Only",
    sensorHealth: 72.1,
    detections:   { critical: 1, high: 4, medium: 9, total: 14 },
    integrations: [
      { name: "Microsoft Sentinel", status: "Pending" },
      { name: "ServiceNow ITSM",    status: "Active" },
      { name: "Falcon Fusion SOAR", status: "N/A" },
      { name: "Splunk SIEM",        status: "N/A" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)",   status: "Active" },
      { name: "Falcon Intelligence",    status: "Active" },
      { name: "Falcon Spotlight (VM)",  status: "Pending" },
      { name: "Falcon Discover",        status: "N/A" },
    ],
    notes: "Escalation raised: sensor check-in rate at 47% (target 95%+). Root cause under investigation; customer IT suspects GPO conflict with existing DLP agent. Credentials delivery blocked pending ISSO approval process. Sensor version pinned to 7.13.x per customer change freeze.",
    escalations: [
      { id: "esc-1", ts: "2024-06-15T11:00:00Z", type: "Sensor Deployment", severity: "P2", description: "Sensor check-in rate stuck at 47%. GPO conflict suspected with Forcepoint DLP agent on Windows endpoints.", status: "Open", engineer: "Sofia Reyes" },
    ],
    checklist: [
      { id: "acc",  label: "Account Created",              checked: true,  timestamp: "2024-06-13T09:00:00Z", engineer: "Sofia Reyes" },
      { id: "sub",  label: "Subscription Tier Activated",  checked: true,  timestamp: "2024-06-13T10:00:00Z", engineer: "Sofia Reyes" },
      { id: "sen",  label: "Endpoint Sensors Deployed",    checked: true,  timestamp: "2024-06-13T15:00:00Z", engineer: "Sofia Reyes" },
      { id: "cred", label: "Admin Credentials Delivered",  checked: false, timestamp: null, engineer: null },
      { id: "pol",  label: "Prevention Policy Configured", checked: false, timestamp: null, engineer: null },
      { id: "hand", label: "Handoff to Customer Success",  checked: false, timestamp: null, engineer: null },
    ],
  },
  {
    id: 4,
    company:      "Goldman Sachs Group, Inc.",
    cid:          "CID-GLDM-F059A1",
    tier:         "Falcon Enterprise",
    industry:     "Financial Services",
    region:       "US-East",
    features:     ["Falcon Prevent", "Cloud Security", "Identity Threat Detection", "Zero Trust Assessment", "Threat Intelligence"],
    status:       "Failed",
    engineer:     "Natalie Chen",
    startDate:    "2024-06-12T09:00:00Z",
    lastUpdated:  "2024-06-13T17:30:00Z",
    completedDate: null,
    seats:        { licensed: 15200, deployed: 0 },
    platforms:    { windows: 0, linux: 0, mac: 0, cloud: 0 },
    sensorVersion: null,
    policyMode:   "Not Configured",
    sensorHealth: 0,
    detections:   { critical: 0, high: 0, medium: 0, total: 0 },
    integrations: [
      { name: "Splunk SIEM",     status: "Failed" },
      { name: "Goldman GS360",   status: "Failed" },
      { name: "ServiceNow ITSM", status: "Pending" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)",             status: "Pending" },
      { name: "Falcon Cloud Security (CWP)",      status: "Pending" },
      { name: "Falcon Identity Threat Detection", status: "Pending" },
      { name: "Falcon Zero Trust Assessment",     status: "Pending" },
      { name: "Falcon Intelligence",              status: "Pending" },
    ],
    notes: "CRITICAL: Sensor deployment blocked. Customer IT firewall blocking outbound traffic to ts01-b.cloudsink.net:443 (Falcon sensor comms). Network change request submitted by customer (CHG-0048821), ETA: 5 business days. No sensors checking in. CID created but unusable until firewall resolved.",
    escalations: [
      { id: "esc-1", ts: "2024-06-13T17:30:00Z", type: "Network Connectivity", severity: "P1", description: "All sensor deployment attempts failed. Firewall blocking Falcon backend (ts01-b.cloudsink.net:443). No hosts checking in.", status: "Open", engineer: "Natalie Chen" },
    ],
    checklist: [
      { id: "acc",  label: "Account Created",              checked: true,  timestamp: "2024-06-12T09:00:00Z", engineer: "Natalie Chen" },
      { id: "sub",  label: "Subscription Tier Activated",  checked: true,  timestamp: "2024-06-12T10:30:00Z", engineer: "Natalie Chen" },
      { id: "sen",  label: "Endpoint Sensors Deployed",    checked: false, timestamp: null, engineer: null },
      { id: "cred", label: "Admin Credentials Delivered",  checked: false, timestamp: null, engineer: null },
      { id: "pol",  label: "Prevention Policy Configured", checked: false, timestamp: null, engineer: null },
      { id: "hand", label: "Handoff to Customer Success",  checked: false, timestamp: null, engineer: null },
    ],
  },
  {
    id: 5,
    company:      "Boeing Defense & Space",
    cid:          "CID-BONG-D743C6",
    tier:         "Falcon Pro",
    industry:     "Defense & Aerospace",
    region:       "US-West",
    features:     ["Falcon Prevent", "Falcon Spotlight", "Threat Intelligence"],
    status:       "Active",
    engineer:     "Vishal Arora",
    startDate:    "2024-06-08T09:00:00Z",
    lastUpdated:  "2024-06-12T12:00:00Z",
    completedDate:"2024-06-12T12:00:00Z",
    seats:        { licensed: 9800, deployed: 9741 },
    platforms:    { windows: 7200, linux: 1900, mac: 641, cloud: 0 },
    sensorVersion:"7.14.17004.0",
    policyMode:   "Prevention",
    sensorHealth: 98.3,
    detections:   { critical: 0, high: 2, medium: 11, total: 13 },
    integrations: [
      { name: "QRadar SIEM",        status: "Active" },
      { name: "ServiceNow ITSM",    status: "Active" },
      { name: "Falcon Fusion SOAR", status: "N/A" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)",  status: "Active" },
      { name: "Falcon Intelligence",   status: "Active" },
      { name: "Falcon Spotlight (VM)", status: "Active" },
      { name: "Falcon Discover",       status: "N/A" },
    ],
    notes: "Smooth deployment. 59 hosts still offline (maintenance windows). QRadar SIEM integration configured using CEF event streaming. Customer IT team was well-prepared; all ports pre-approved before kickoff.",
    escalations: [],
    checklist: [
      { id: "acc",  label: "Account Created",              checked: true, timestamp: "2024-06-08T09:00:00Z", engineer: "Vishal Arora" },
      { id: "sub",  label: "Subscription Tier Activated",  checked: true, timestamp: "2024-06-08T10:00:00Z", engineer: "Vishal Arora" },
      { id: "sen",  label: "Endpoint Sensors Deployed",    checked: true, timestamp: "2024-06-09T14:00:00Z", engineer: "Vishal Arora" },
      { id: "cred", label: "Admin Credentials Delivered",  checked: true, timestamp: "2024-06-10T09:00:00Z", engineer: "Vishal Arora" },
      { id: "pol",  label: "Prevention Policy Configured", checked: true, timestamp: "2024-06-11T11:00:00Z", engineer: "Vishal Arora" },
      { id: "hand", label: "Handoff to Customer Success",  checked: true, timestamp: "2024-06-12T12:00:00Z", engineer: "Vishal Arora" },
    ],
  },
  {
    id: 6,
    company:      "Pfizer Inc.",
    cid:          "CID-PFIZ-A122B9",
    tier:         "Falcon Go",
    industry:     "Pharmaceuticals",
    region:       "EU-West",
    features:     ["Falcon Prevent", "Falcon Discover"],
    status:       "Pending",
    engineer:     "James Okafor",
    startDate:    "2024-06-15T07:00:00Z",
    lastUpdated:  "2024-06-15T07:00:00Z",
    completedDate: null,
    seats:        { licensed: 3200, deployed: 120 },
    platforms:    { windows: 120, linux: 0, mac: 0, cloud: 0 },
    sensorVersion:"7.14.17004.0",
    policyMode:   "Alert Only",
    sensorHealth: 100,
    detections:   { critical: 0, high: 0, medium: 0, total: 0 },
    integrations: [
      { name: "Microsoft Sentinel", status: "Pending" },
      { name: "ServiceNow ITSM",    status: "Pending" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)", status: "Active" },
      { name: "Falcon Discover",      status: "Pending" },
    ],
    notes: "EU-West tenant (data residency: eu-1.crowdstrike.com). GDPR data handling review in progress. Pilot deployment started with 120 hosts in IT lab. Full rollout pending security review sign-off from DPO.",
    escalations: [],
    checklist: [
      { id: "acc",  label: "Account Created",              checked: true,  timestamp: "2024-06-15T07:00:00Z", engineer: "James Okafor" },
      { id: "sub",  label: "Subscription Tier Activated",  checked: false, timestamp: null, engineer: null },
      { id: "sen",  label: "Endpoint Sensors Deployed",    checked: false, timestamp: null, engineer: null },
      { id: "cred", label: "Admin Credentials Delivered",  checked: false, timestamp: null, engineer: null },
      { id: "pol",  label: "Prevention Policy Configured", checked: false, timestamp: null, engineer: null },
      { id: "hand", label: "Handoff to Customer Success",  checked: false, timestamp: null, engineer: null },
    ],
  },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const STATUS_META = {
  Active:        { ring: "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50", dot: "bg-emerald-400", color: "#34d399" },
  Pending:       { ring: "bg-yellow-900/40 text-yellow-300 border border-yellow-700/50",   dot: "bg-yellow-400",  color: "#facc15" },
  Failed:        { ring: "bg-red-900/40 text-red-400 border border-red-700/50",             dot: "bg-red-500",     color: "#f87171" },
  "Under Review":{ ring: "bg-blue-900/40 text-blue-300 border border-blue-700/50",         dot: "bg-blue-400",    color: "#60a5fa" },
};

const TIER_CLS = {
  "Falcon Enterprise": "text-red-400 font-semibold",
  "Falcon Pro":        "text-slate-300 font-medium",
  "Falcon Go":         "text-slate-400",
};

const TIER_BADGE = {
  "Falcon Enterprise": "bg-red-950/50 text-red-400 border-red-800/50",
  "Falcon Pro":        "bg-slate-800/60 text-slate-300 border-slate-600/50",
  "Falcon Go":         "bg-slate-800/40 text-slate-400 border-slate-700/50",
};

const POLICY_CLS = {
  "Prevention":     "text-emerald-400 bg-emerald-950/40 border-emerald-700/40",
  "Alert Only":     "text-yellow-400 bg-yellow-950/40 border-yellow-700/40",
  "Not Configured": "text-red-400 bg-red-950/40 border-red-700/40",
};

const INTEG_META = {
  Active:  { cls: "text-emerald-400", icon: "✓" },
  Pending: { cls: "text-yellow-400",  icon: "◌" },
  Failed:  { cls: "text-red-400",     icon: "✗" },
  "N/A":   { cls: "text-slate-600",   icon: "N/A" },
};

const MOD_META = {
  Active:  "text-emerald-400",
  Pending: "text-yellow-400",
  "N/A":   "text-slate-600",
};

// ── Utility ───────────────────────────────────────────────────────────────────
function fmt(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtNum(n) {
  return n?.toLocaleString("en-US") ?? "0";
}

function coveragePct(seats) {
  if (!seats.licensed) return 0;
  return Math.round((seats.deployed / seats.licensed) * 100);
}

function ttpDays(c) {
  if (!c.completedDate || !c.startDate) return null;
  return Math.round((new Date(c.completedDate) - new Date(c.startDate)) / 86400000);
}

function slaTargetDate(c) {
  const days = SLA_BY_TIER[c.tier] ?? 5;
  return new Date(new Date(c.startDate).getTime() + days * 86400000);
}

function slaStatus(c) {
  if (c.status === "Active") return { state: "completed", ttp: ttpDays(c) };
  const target = slaTargetDate(c);
  const now = Date.now();
  const diffMs = target - now;
  const diffH  = diffMs / 3600000;
  if (diffMs > 0) return { state: "ok", hoursLeft: Math.round(diffH) };
  const overdueH = Math.abs(Math.round(diffH));
  const overdueD = Math.floor(overdueH / 24);
  return { state: "breached", overdueH, overdueD };
}

function progress(checklist) {
  const done = checklist.filter(i => i.checked).length;
  return { done, total: checklist.length, pct: Math.round((done / checklist.length) * 100) };
}

function healthColor(pct) {
  if (pct >= 95) return "#34d399";
  if (pct >= 80) return "#facc15";
  return "#f87171";
}

function coverageColor(pct) {
  if (pct >= 90) return "#34d399";
  if (pct >= 60) return "#facc15";
  return "#f87171";
}

// ── DonutChart (pure SVG) ─────────────────────────────────────────────────────
function DonutChart({ segments, size = 80, thickness = 10 }) {
  const r  = (size - thickness) / 2 - 1;
  const cx = size / 2, cy = size / 2;
  const C  = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={thickness} />
    </svg>
  );
  let offset = 0;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * C;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-offset} />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ── SLABadge ─────────────────────────────────────────────────────────────────
function SLABadge({ customer }) {
  const s = slaStatus(customer);
  if (s.state === "completed") {
    return (
      <span className="text-xs px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 rounded font-mono">
        ✓ {s.ttp}d TTP
      </span>
    );
  }
  if (s.state === "breached") {
    return (
      <span className="text-xs px-1.5 py-0.5 bg-red-950/60 border border-red-700/60 text-red-400 rounded font-mono animate-pulse">
        ⚠ {s.overdueD}d overdue
      </span>
    );
  }
  const urgency = s.hoursLeft < 24 ? "text-orange-400 border-orange-700/60 bg-orange-950/40" : "text-slate-400 border-slate-700/40 bg-slate-800/40";
  return (
    <span className={`text-xs px-1.5 py-0.5 border rounded font-mono ${urgency}`}>
      {s.hoursLeft}h left
    </span>
  );
}

// ── PlatformBar ───────────────────────────────────────────────────────────────
function PlatformBar({ platforms }) {
  const items = [
    { key: "windows", label: "Win", color: "#60a5fa" },
    { key: "linux",   label: "Lnx", color: "#a78bfa" },
    { key: "mac",     label: "Mac", color: "#94a3b8" },
    { key: "cloud",   label: "Cld", color: "#34d399" },
  ].filter(i => platforms[i.key] > 0);
  if (items.length === 0) return <span className="text-xs text-slate-600">No sensors</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(i => (
        <span key={i.key} className="text-xs px-1.5 py-0.5 rounded border border-slate-700/50 bg-slate-800/60 tabular-nums" style={{ color: i.color }}>
          {i.label} {fmtNum(platforms[i.key])}
        </span>
      ))}
    </div>
  );
}

// ── WorkloadTooltip ───────────────────────────────────────────────────────────
function WorkloadTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-200 font-semibold mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill }} className="leading-5">
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── RunbookPanel ──────────────────────────────────────────────────────────────
function RunbookPanel({ customer }) {
  const nextStep = customer.checklist.find(i => !i.checked);
  const [open, setOpen] = useState(nextStep?.id ?? null);
  return (
    <div className="p-4 space-y-2">
      {nextStep ? (
        <div className="mb-3 px-3 py-2.5 bg-amber-950/40 border border-amber-700/40 rounded-lg">
          <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">Next Required Action</p>
          <p className="text-xs text-amber-200/80 mt-0.5">{nextStep.label}</p>
        </div>
      ) : (
        <div className="mb-3 px-3 py-2.5 bg-emerald-950/40 border border-emerald-700/40 rounded-lg">
          <p className="text-xs font-semibold text-emerald-300">All provisioning steps complete</p>
        </div>
      )}
      {customer.checklist.map(step => (
        <div key={step.id} className={`rounded-lg border overflow-hidden ${
          step.checked ? "border-emerald-800/30" : step.id === nextStep?.id ? "border-amber-600/50" : "border-slate-700/40"
        }`}>
          <button
            onClick={() => setOpen(open === step.id ? null : step.id)}
            className={`w-full px-3 py-2.5 flex items-center gap-2.5 text-left transition-colors ${
              step.checked ? "bg-emerald-950/20" : step.id === nextStep?.id ? "bg-amber-950/30" : "bg-slate-800/30 hover:bg-slate-800/50"
            }`}
          >
            <span className={`text-xs shrink-0 ${step.checked ? "text-emerald-400" : "text-slate-600"}`}>{step.checked ? "✓" : "○"}</span>
            <span className={`text-xs font-medium flex-1 leading-snug ${step.checked ? "text-emerald-300 line-through" : step.id === nextStep?.id ? "text-amber-200" : "text-slate-300"}`}>{step.label}</span>
            <span className="text-slate-600 text-xs">{open === step.id ? "▲" : "▼"}</span>
          </button>
          {open === step.id && RUNBOOK[step.id] && (
            <div className="px-3 pb-3 pt-2 bg-slate-900/60 space-y-2">
              {RUNBOOK[step.id].map((line, i) => (
                <div key={i} className="flex gap-2 text-xs text-slate-400">
                  <span className="text-slate-600 font-mono shrink-0 mt-px">{i + 1}.</span>
                  <span className="leading-relaxed">{line}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── DetailsPanel ──────────────────────────────────────────────────────────────
function DetailsPanel({ customer, onCopyCID }) {
  const cvg = coveragePct(customer.seats);
  return (
    <div className="p-4 space-y-5">
      {/* Identity */}
      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Tenant Identity</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">CID</span>
            <button
              onClick={() => onCopyCID(customer.cid)}
              className="flex items-center gap-1.5 text-xs font-mono text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 transition-colors"
              title="Click to copy"
            >
              {customer.cid}
              <span className="text-slate-500 text-[10px]">⎘</span>
            </button>
          </div>
          <Row label="Industry"  value={customer.industry} />
          <Row label="Region"    value={customer.region} />
          <Row label="SLA Target" value={`${SLA_BY_TIER[customer.tier]}d from kickoff (${customer.tier})`} />
          {customer.sensorVersion && <Row label="Sensor Ver." value={customer.sensorVersion} mono />}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Policy Mode</span>
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${POLICY_CLS[customer.policyMode]}`}>
              {customer.policyMode}
            </span>
          </div>
        </div>
      </section>

      {/* Seat coverage */}
      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Seat Coverage</p>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">{fmtNum(customer.seats.deployed)} / {fmtNum(customer.seats.licensed)} deployed</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: coverageColor(cvg) }}>{cvg}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cvg}%`, background: coverageColor(cvg) }} />
        </div>
        {cvg < 95 && customer.status !== "Active" && (
          <p className="text-xs text-yellow-400/80 mt-1.5">
            {fmtNum(customer.seats.licensed - customer.seats.deployed)} seats not yet deployed
          </p>
        )}
      </section>

      {/* Platform breakdown */}
      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Endpoint Platforms</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { key: "windows", label: "Windows",         color: "#60a5fa" },
            { key: "linux",   label: "Linux",           color: "#a78bfa" },
            { key: "mac",     label: "macOS",           color: "#94a3b8" },
            { key: "cloud",   label: "Cloud Workloads", color: "#34d399" },
          ].map(p => (
            <div key={p.key} className="flex items-center justify-between px-2 py-1.5 bg-slate-800/50 rounded border border-slate-700/40">
              <span className="text-xs text-slate-400">{p.label}</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: p.color }}>{fmtNum(customer.platforms[p.key])}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Sensor health + detections */}
      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Sensor Health & Telemetry</p>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">Check-in rate</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: healthColor(customer.sensorHealth) }}>
            {customer.sensorHealth}%
          </span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-3">
          <div className="h-full rounded-full transition-all" style={{ width: `${customer.sensorHealth}%`, background: healthColor(customer.sensorHealth) }} />
        </div>
        {customer.detections.total > 0 ? (
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[
              { label: "Critical", val: customer.detections.critical, color: "#f87171" },
              { label: "High",     val: customer.detections.high,     color: "#fb923c" },
              { label: "Medium",   val: customer.detections.medium,   color: "#facc15" },
              { label: "Total",    val: customer.detections.total,    color: "#94a3b8" },
            ].map(d => (
              <div key={d.label} className="bg-slate-800/50 rounded border border-slate-700/40 py-1.5">
                <div className="text-sm font-bold tabular-nums" style={{ color: d.color }}>{d.val}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{d.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">No detections recorded</p>
        )}
      </section>

      {/* Modules */}
      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Module Activation</p>
        <div className="space-y-1.5">
          {customer.modules.map(m => (
            <div key={m.name} className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
              <span className="text-xs text-slate-400 leading-snug">{m.name}</span>
              <span className={`text-xs font-medium ${MOD_META[m.status]}`}>{m.status}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Integrations</p>
        <div className="space-y-1.5">
          {customer.integrations.map(intg => {
            const meta = INTEG_META[intg.status];
            return (
              <div key={intg.name} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{intg.name}</span>
                <span className={`text-xs font-medium flex items-center gap-1 ${meta.cls}`}>
                  <span>{meta.icon}</span>{intg.status}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Escalations */}
      {customer.escalations.length > 0 && (
        <section>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Open Escalations</p>
          {customer.escalations.map(esc => (
            <div key={esc.id} className="p-3 bg-red-950/30 border border-red-800/40 rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-400">{esc.severity}</span>
                <span className="text-xs text-slate-300">{esc.type}</span>
                <span className="ml-auto text-xs text-red-400/70">{esc.status}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{esc.description}</p>
              <p className="text-[10px] text-slate-500">{fmt(esc.ts)} · {esc.engineer}</p>
            </div>
          ))}
        </section>
      )}

      {/* Notes */}
      {customer.notes && (
        <section>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Engineer Notes</p>
          <p className="text-xs text-slate-400 leading-relaxed bg-slate-800/40 rounded-lg p-3 border border-slate-700/40">
            {customer.notes}
          </p>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [customers, setCustomers]         = useState(INITIAL_CUSTOMERS);
  const [selected, setSelected]           = useState(null);
  const [activeTab, setActiveTab]         = useState("checklist");
  const [auditLog, setAuditLog]           = useState([
    { id: 1, ts: "2024-06-14T10:22:00Z", action: "Handoff to Customer Success completed",                 customer: "Northrop Grumman Corporation", engineer: "Priya Mehta"  },
    { id: 2, ts: "2024-06-13T17:30:00Z", action: "Escalation [P1] raised: firewall blocking Falcon comms", customer: "Goldman Sachs Group, Inc.",     engineer: "Natalie Chen" },
    { id: 3, ts: "2024-06-13T15:00:00Z", action: "Endpoint Sensors Deployed checked",                     customer: "Lockheed Martin Corporation",  engineer: "Sofia Reyes"  },
    { id: 4, ts: "2024-06-12T12:00:00Z", action: "Handoff to Customer Success completed",                 customer: "Boeing Defense & Space",        engineer: "Vishal Arora" },
  ]);
  const [showEscalate, setShowEscalate]   = useState(false);
  const [escalateForm, setEscalateForm]   = useState({ type: "Sensor Deployment", severity: "P2", description: "" });
  const [currentEngineer]                 = useState("Vishal Arora");
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState("All");
  const [filterTier, setFilterTier]       = useState("All");
  const [filterRegion, setFilterRegion]   = useState("All Regions");
  const [showWorkload, setShowWorkload]   = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [copiedCID, setCopiedCID]         = useState(null);
  const [now, setNow]                     = useState(Date.now());
  const searchRef = useRef(null);

  // tick every minute for live SLA timers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      if (e.key === "/")                      { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape")                  { showEscalate ? setShowEscalate(false) : setSelected(null); }
      if (e.key === "w" || e.key === "W")      setShowWorkload(p => !p);
      if (e.key === "?")                       setShowShortcuts(p => !p);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEscalate]);

  function handleCopyCID(cid) {
    navigator.clipboard?.writeText(cid).catch(() => {});
    setCopiedCID(cid);
    setTimeout(() => setCopiedCID(null), 2000);
  }

  // derived data
  const atRisk = customers.filter(c => slaStatus(c).state === "breached");
  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    const hit = !q || c.company.toLowerCase().includes(q) || c.engineer.toLowerCase().includes(q)
      || c.tier.toLowerCase().includes(q) || c.cid.toLowerCase().includes(q)
      || c.industry.toLowerCase().includes(q) || c.features.some(f => f.toLowerCase().includes(q));
    return hit
      && (filterStatus === "All" || c.status === filterStatus)
      && (filterTier === "All" || c.tier === filterTier)
      && (filterRegion === "All Regions" || c.region === filterRegion);
  });

  const stats = {
    total:        customers.length,
    active:       customers.filter(c => c.status === "Active").length,
    pending:      customers.filter(c => c.status === "Pending").length,
    failed:       customers.filter(c => c.status === "Failed").length,
    underReview:  customers.filter(c => c.status === "Under Review").length,
    totalSeats:   customers.reduce((a, c) => a + c.seats.licensed, 0),
    deployedSeats:customers.reduce((a, c) => a + c.seats.deployed, 0),
  };

  const avgTTP = (() => {
    const completed = customers.filter(c => c.completedDate);
    if (!completed.length) return null;
    const avg = completed.reduce((a, c) => a + ttpDays(c), 0) / completed.length;
    return avg.toFixed(1);
  })();

  const fleetCoverage = stats.totalSeats ? Math.round((stats.deployedSeats / stats.totalSeats) * 100) : 0;

  const donutSegments = [
    { label: "Active",       value: stats.active,      color: "#34d399" },
    { label: "Pending",      value: stats.pending,     color: "#facc15" },
    { label: "Under Review", value: stats.underReview, color: "#60a5fa" },
    { label: "Failed",       value: stats.failed,      color: "#f87171" },
  ].filter(s => s.value > 0);

  const workloadData = ENGINEERS.map(eng => {
    const rows = customers.filter(c => c.engineer === eng);
    return {
      name:          eng.split(" ")[0],
      Active:        rows.filter(c => c.status === "Active").length,
      Pending:       rows.filter(c => c.status === "Pending").length,
      "Under Review":rows.filter(c => c.status === "Under Review").length,
      Failed:        rows.filter(c => c.status === "Failed").length,
    };
  }).filter(d => d.Active + d.Pending + d["Under Review"] + d.Failed > 0);

  const sel = customers.find(c => c.id === selected);

  function addLog(action, company, eng) {
    setAuditLog(prev => [{ id: Date.now(), ts: new Date().toISOString(), action, customer: company, engineer: eng }, ...prev]);
  }

  function toggleCheck(customerId, checkId) {
    setCustomers(prev => prev.map(c => {
      if (c.id !== customerId) return c;
      const newChecklist = c.checklist.map(item => {
        if (item.id !== checkId) return item;
        const now2 = !item.checked;
        addLog(`${item.label} ${now2 ? "checked" : "unchecked"}`, c.company, currentEngineer);
        return { ...item, checked: now2, timestamp: now2 ? new Date().toISOString() : null, engineer: now2 ? currentEngineer : null };
      });
      const allDone     = newChecklist.every(i => i.checked);
      const newStatus   = allDone ? "Active" : c.status === "Active" ? "Pending" : c.status;
      const completedTs = allDone ? new Date().toISOString() : c.completedDate;
      return { ...c, checklist: newChecklist, status: newStatus, lastUpdated: new Date().toISOString(), completedDate: completedTs };
    }));
  }

  function submitEscalation() {
    if (!sel || !escalateForm.description.trim()) return;
    const msg = `Escalation [${escalateForm.severity}] raised: ${escalateForm.type}: ${escalateForm.description.slice(0, 60)}${escalateForm.description.length > 60 ? "…" : ""}`;
    addLog(msg, sel.company, currentEngineer);
    setCustomers(prev => prev.map(c => {
      if (c.id !== selected) return c;
      const newEsc = { id: `esc-${Date.now()}`, ts: new Date().toISOString(), type: escalateForm.type, severity: escalateForm.severity, description: escalateForm.description, status: "Open", engineer: currentEngineer };
      return { ...c, status: "Under Review", lastUpdated: new Date().toISOString(), escalations: [...c.escalations, newEsc] };
    }));
    setEscalateForm({ type: "Sensor Deployment", severity: "P2", description: "" });
    setShowEscalate(false);
  }

  function exportCSV() {
    const headers = ["Company", "CID", "Tier", "Industry", "Region", "Status", "Engineer", "Coverage %", "Sensor Health %", "Policy Mode", "Progress %", "TTP (days)", "SLA Target", "Last Updated", "SLA Breach"];
    const rows = filtered.map(c => {
      const { pct } = progress(c.checklist);
      const sl = slaStatus(c);
      const breach = sl.state === "breached" ? `Yes (${sl.overdueD}d)` : "No";
      return [c.company, c.cid, c.tier, c.industry, c.region, c.status, c.engineer, coveragePct(c.seats), c.sensorHealth, c.policyMode, pct, ttpDays(c) ?? "", slaTargetDate(c).toISOString(), c.lastUpdated, breach];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `provisioning-${new Date().toISOString().slice(0,10)}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  const activeFilters = search || filterStatus !== "All" || filterTier !== "All" || filterRegion !== "All Regions";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">

      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-6 justify-between">
          {/* brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center shadow-lg shadow-red-900/50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm tracking-widest">CROWDSTRIKE</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-red-900/50 border border-red-700/50 text-red-400 rounded font-mono uppercase tracking-wider">Provisioning</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5 tracking-wide">Customer Provisioning Tracker · Internal Tool</p>
            </div>
          </div>

          {/* donut + legend */}
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <DonutChart segments={donutSegments} size={76} thickness={10} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-white font-bold text-base leading-none">{stats.total}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5">tenants</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
              {donutSegments.map(s => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-xs text-slate-400">{s.label}</span>
                  <span className="text-xs font-bold ml-auto pl-1 tabular-nums" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* fleet KPIs */}
          <div className="hidden xl:flex items-center gap-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2">
            {[
              { label: "Fleet Coverage",  value: `${fleetCoverage}%`,         color: coverageColor(fleetCoverage) },
              { label: "Total Seats",     value: fmtNum(stats.totalSeats),     color: "#94a3b8" },
              { label: "Deployed",        value: fmtNum(stats.deployedSeats),  color: "#60a5fa" },
              { label: "Avg TTP",         value: avgTTP ? `${avgTTP}d` : "N/A",  color: "#a78bfa" },
              { label: "Escalations",     value: customers.reduce((a,c)=>a+c.escalations.filter(e=>e.status==="Open").length,0), color: "#f87171" },
            ].map((kpi, i) => (
              <div key={kpi.label} className="flex flex-col items-center px-3">
                <span className="text-sm font-bold tabular-nums leading-none" style={{ color: kpi.color }}>{kpi.value}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">{kpi.label}</span>
                {i < 4 && <div className="absolute right-0 top-1/4 h-1/2 w-px bg-slate-700/50" />}
              </div>
            ))}
          </div>

          {/* actions */}
          <div className="flex items-center gap-2 shrink-0">
            {atRisk.length > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/60 border border-red-700/50 rounded-full text-xs text-red-300 animate-pulse">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                {atRisk.length} SLA breach{atRisk.length !== 1 ? "es" : ""}
              </span>
            )}
            <button onClick={() => setShowWorkload(p => !p)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${showWorkload ? "bg-indigo-900/40 border-indigo-600/50 text-indigo-300" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"}`}>
              Workload
            </button>
            <button onClick={exportCSV}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-1.5">
              ↓ CSV
            </button>
            <button onClick={() => setShowShortcuts(p => !p)}
              className="w-7 h-7 flex items-center justify-center text-xs bg-slate-800 border border-slate-700 text-slate-500 rounded-lg hover:text-slate-300 transition-colors">
              ?
            </button>
            <div className="w-px h-5 bg-slate-700/80" />
            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-300 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">{currentEngineer}</span>
              <span className="text-[10px] text-slate-600 mt-0.5">Provisioning Engineer</span>
            </div>
          </div>
        </div>
      </header>

      {copiedCID && (
        <div className="fixed top-16 right-6 z-50 px-3 py-2 bg-emerald-900/90 border border-emerald-700/50 text-emerald-300 text-xs rounded-lg shadow-xl transition-all">
          ✓ Copied: {copiedCID}
        </div>
      )}

      <div className="max-w-screen-2xl mx-auto px-6 py-5 space-y-4">

        {/* ── At-Risk Banner ── */}
        {atRisk.length > 0 && (
          <div className="px-4 py-3 bg-red-950/50 border border-red-800/50 rounded-xl flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 bg-red-900/50 border border-red-700/50 rounded-lg flex items-center justify-center text-red-400 mt-0.5">⚠</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-300">
                SLA Breach Alert: {atRisk.length} customer{atRisk.length !== 1 ? "s" : ""} overdue
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {atRisk.map(c => {
                  const sl = slaStatus(c);
                  return (
                    <button key={c.id} onClick={() => { setSelected(c.id); setActiveTab("checklist"); }}
                      className="text-xs px-2.5 py-1 bg-red-900/50 border border-red-700/50 text-red-300 rounded-full hover:bg-red-800/60 transition-colors flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[c.status].dot}`} />
                      {c.company.split(" ")[0]} · {sl.overdueD}d overdue · {c.engineer}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Workload Dashboard ── */}
        {showWorkload && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Engineer Workload Dashboard</h2>
                <p className="text-xs text-slate-500 mt-0.5">Open provisioning assignments by status per engineer</p>
              </div>
              <button onClick={() => setShowWorkload(false)} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
            </div>
            <div className="grid grid-cols-5 gap-3 mb-5">
              {ENGINEERS.map(eng => {
                const assigned = customers.filter(c => c.engineer === eng);
                const open = assigned.filter(c => c.status !== "Active").length;
                const totalSeatsEng = assigned.reduce((a, c) => a + c.seats.licensed, 0);
                return (
                  <div key={eng} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-200">{eng.split(" ")[0]}</p>
                    <p className="text-[10px] text-slate-500 mb-2">{eng.split(" ")[1]}</p>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-lg font-bold text-white tabular-nums">{assigned.length}</div>
                        <div className="text-[10px] text-slate-500">customers</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums" style={{ color: open > 0 ? "#facc15" : "#34d399" }}>{open}</div>
                        <div className="text-[10px] text-slate-500">open</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] text-slate-500">{fmtNum(totalSeatsEng)} seats</div>
                  </div>
                );
              })}
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={workloadData} barSize={20} barCategoryGap="40%">
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
                <Tooltip content={<WorkloadTooltip />} cursor={{ fill: "rgba(148,163,184,0.04)" }} />
                <Bar dataKey="Active"        stackId="a" fill="#34d399" />
                <Bar dataKey="Pending"       stackId="a" fill="#facc15" />
                <Bar dataKey="Under Review"  stackId="a" fill="#60a5fa" />
                <Bar dataKey="Failed"        stackId="a" fill="#f87171" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-5 mt-2 justify-center">
              {[["Active","#34d399"],["Pending","#facc15"],["Under Review","#60a5fa"],["Failed","#f87171"]].map(([l,c]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                  <span className="text-xs text-slate-500">{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search + Filters ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-64 max-w-lg">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">⌕</span>
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder='Search company, CID, engineer, industry, feature… ("/")'
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-8 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors" />
            {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-base">×</button>}
          </div>
          {[
            { value: filterStatus,   onChange: setFilterStatus,  options: ["All", ...STATUSES],  placeholder: "All Statuses" },
            { value: filterTier,     onChange: setFilterTier,    options: ["All", ...TIERS],      placeholder: "All Tiers" },
            { value: filterRegion,   onChange: setFilterRegion,  options: REGIONS,                placeholder: "All Regions" },
          ].map((f, i) => (
            <select key={i} value={f.value} onChange={e => f.onChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-slate-500 cursor-pointer">
              {f.options.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          {activeFilters && (
            <button onClick={() => { setSearch(""); setFilterStatus("All"); setFilterTier("All"); setFilterRegion("All Regions"); }}
              className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 transition-colors">
              Clear
            </button>
          )}
          <span className="text-xs text-slate-500 ml-auto whitespace-nowrap">{filtered.length} / {customers.length} customers</span>
        </div>

        {/* ── Main content ── */}
        <div className="flex gap-5 items-start">

          {/* ── Table ── */}
          <div className="flex-1 min-w-0 space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/50">
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Customer / CID</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Tier</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Seat Coverage</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Platforms</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Progress</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Status / SLA</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Health</th>
                    <th className="text-left text-xs text-slate-400 uppercase tracking-wider px-4 py-3 font-medium">Engineer</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500 text-sm">No customers match your filters</td></tr>
                  ) : filtered.map(c => {
                    const { done, total, pct } = progress(c.checklist);
                    const cvg  = coveragePct(c.seats);
                    const sl   = slaStatus(c);
                    const barC = pct === 100 ? "#34d399" : pct >= 50 ? "#facc15" : "#f87171";
                    const hasOpenEsc = c.escalations.some(e => e.status === "Open");
                    return (
                      <tr key={c.id}
                        onClick={() => { setSelected(c.id); setActiveTab("checklist"); }}
                        className={`border-b border-slate-800/40 cursor-pointer transition-colors ${selected === c.id ? "bg-slate-800/80" : "hover:bg-slate-800/40"}`}
                      >
                        {/* Company + CID */}
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            {hasOpenEsc && <span className="text-red-400 text-xs shrink-0 mt-0.5">●</span>}
                            <div className="min-w-0">
                              <div className="font-semibold text-white text-sm leading-snug truncate max-w-[200px]">{c.company}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-slate-500">{c.cid}</span>
                                <span className="text-[10px] text-slate-600">·</span>
                                <span className="text-[10px] text-slate-500">{c.industry}</span>
                              </div>
                              {sl.state === "breached" && (
                                <span className="text-[10px] text-red-400 font-medium">{sl.overdueD}d SLA breach</span>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Tier */}
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded border ${TIER_BADGE[c.tier]}`}>{c.tier.replace("Falcon ", "")}</span>
                          <div className="text-[10px] text-slate-500 mt-1">{c.region}</div>
                        </td>
                        {/* Seat coverage */}
                        <td className="px-4 py-3 w-36">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-slate-400 tabular-nums">{fmtNum(c.seats.deployed)}<span className="text-slate-600">/{fmtNum(c.seats.licensed)}</span></span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: coverageColor(cvg) }}>{cvg}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${cvg}%`, background: coverageColor(cvg) }} />
                          </div>
                        </td>
                        {/* Platforms */}
                        <td className="px-4 py-3">
                          <PlatformBar platforms={c.platforms} />
                        </td>
                        {/* Progress */}
                        <td className="px-4 py-3 w-28">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-slate-400 tabular-nums">{done}/{total}</span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: barC }}>{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barC }} />
                          </div>
                        </td>
                        {/* Status + SLA */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_META[c.status].ring}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[c.status].dot}`} />
                            {c.status}
                          </span>
                          <div className="mt-1.5"><SLABadge customer={c} /></div>
                        </td>
                        {/* Health */}
                        <td className="px-4 py-3 w-20">
                          {c.seats.deployed > 0 ? (
                            <>
                              <div className="text-sm font-bold tabular-nums" style={{ color: healthColor(c.sensorHealth) }}>{c.sensorHealth}%</div>
                              <div className="text-[10px] text-slate-500">check-in</div>
                            </>
                          ) : (
                            <span className="text-xs text-slate-600">N/A</span>
                          )}
                        </td>
                        {/* Engineer */}
                        <td className="px-4 py-3">
                          <div className="text-xs text-slate-300">{c.engineer.split(" ")[0]}</div>
                          <div className="text-[10px] text-slate-500">{c.engineer.split(" ")[1]}</div>
                          <div className="text-[10px] text-slate-600 mt-0.5">{fmt(c.lastUpdated)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Audit Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Compliance Audit Log
                </span>
                <span className="text-xs text-slate-500 font-mono">{auditLog.length} entries</span>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {auditLog.map(entry => (
                  <div key={entry.id} className="px-5 py-3 border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-200 leading-snug">{entry.action}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{entry.customer} · {entry.engineer}</p>
                      </div>
                      <span className="text-xs text-slate-500 whitespace-nowrap font-mono shrink-0">{fmt(entry.ts)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Side Panel ── */}
          {sel && (
            <div className="w-[340px] shrink-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden self-start sticky top-20">
              {/* panel header */}
              <div className="px-5 py-4 border-b border-slate-800 bg-slate-800/30">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <h2 className="text-sm font-semibold text-white leading-snug">{sel.company}</h2>
                    <button onClick={() => handleCopyCID(sel.cid)} className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors mt-0.5 flex items-center gap-1">
                      {sel.cid} <span className="text-slate-600">⎘</span>
                    </button>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 text-xl leading-none mt-0.5">×</button>
                </div>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_META[sel.status].ring}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[sel.status].dot}`} />
                    {sel.status}
                  </span>
                  <SLABadge customer={sel} />
                  {sel.escalations.some(e => e.status === "Open") && (
                    <span className="text-xs px-2 py-0.5 bg-red-900/40 border border-red-700/40 text-red-400 rounded-full">
                      {sel.escalations.filter(e => e.status === "Open").length} escalation
                    </span>
                  )}
                </div>
                {/* progress strip */}
                {(() => {
                  const { done, total, pct } = progress(sel.checklist);
                  const cvg = coveragePct(sel.seats);
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                          <span>Steps</span><span className="font-semibold text-slate-300">{done}/{total}</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? "#34d399" : "#f59e0b" }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                          <span>Coverage</span><span className="font-semibold" style={{ color: coverageColor(cvg) }}>{cvg}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${cvg}%`, background: coverageColor(cvg) }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* tabs */}
              <div className="flex border-b border-slate-800">
                {[["checklist","Steps"],["runbook","Runbook"],["details","Details"],["escalate","Escalate"]].map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 text-xs py-2.5 font-medium transition-colors border-b-2 ${activeTab === tab ? "text-white border-red-500 bg-slate-800/40" : "text-slate-400 hover:text-slate-300 border-transparent"}`}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="max-h-[560px] overflow-y-auto">
                {activeTab === "checklist" && (
                  <div className="p-4 space-y-2.5">
                    {sel.checklist.map((item, idx) => (
                      <div key={item.id} className={`flex gap-3 p-3 rounded-lg border transition-colors ${item.checked ? "bg-emerald-950/30 border-emerald-800/40" : "bg-slate-800/40 border-slate-700/40"}`}>
                        <input type="checkbox" checked={item.checked} onChange={() => toggleCheck(sel.id, item.id)} className="w-4 h-4 accent-emerald-500 cursor-pointer mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium leading-snug ${item.checked ? "text-emerald-300 line-through" : "text-slate-200"}`}>
                            {idx + 1}. {item.label}
                          </p>
                          {item.checked && <p className="text-xs text-slate-500 mt-0.5">{fmt(item.timestamp)} · {item.engineer}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === "runbook"   && <RunbookPanel customer={sel} />}
                {activeTab === "details"   && <DetailsPanel customer={sel} onCopyCID={handleCopyCID} />}
                {activeTab === "escalate"  && (
                  <div className="p-4 space-y-3">
                    <button onClick={() => setShowEscalate(true)}
                      className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                      <span>⚠</span> Escalate to Engineering
                    </button>
                    <p className="text-xs text-slate-500 text-center">Status will change to Under Review</p>
                    {sel.escalations.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Escalation History</p>
                        {sel.escalations.map(esc => (
                          <div key={esc.id} className="p-3 bg-red-950/30 border border-red-800/40 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold ${esc.severity === "P1" ? "text-red-400" : esc.severity === "P2" ? "text-yellow-400" : "text-blue-400"}`}>{esc.severity}</span>
                              <span className="text-xs text-slate-300">{esc.type}</span>
                              <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${esc.status === "Open" ? "text-red-400 border-red-700/50 bg-red-950/40" : "text-emerald-400 border-emerald-700/50 bg-emerald-950/40"}`}>{esc.status}</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">{esc.description}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{fmt(esc.ts)} · {esc.engineer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Keyboard Shortcuts Modal ── */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold text-sm">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-3">
              {[
                ["/",   "Focus search bar"],
                ["Esc", "Close panel or modal"],
                ["W",   "Toggle workload dashboard"],
                ["?",   "Show this help"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-400">{desc}</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded font-mono shrink-0">{key}</kbd>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-5 border-t border-slate-800 pt-4">
              Click a CID anywhere to copy it to clipboard.
            </p>
          </div>
        </div>
      )}

      {/* ── Escalation Modal ── */}
      {showEscalate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold">Escalate to Engineering</h3>
                <p className="text-xs text-slate-400 mt-0.5">{sel?.company} · {sel?.cid}</p>
              </div>
              <button onClick={() => setShowEscalate(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Issue Type</label>
                <select value={escalateForm.type} onChange={e => setEscalateForm(p => ({ ...p, type: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500">
                  {["Sensor Deployment","License Activation","Credential Issue","Policy Configuration","Integration Failure","Network Connectivity","CID / Tenant Issue","Module Activation"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Severity</label>
                <div className="flex gap-2">
                  {[
                    { s: "P1", label: "P1 Critical",  desc: "Immediate response, full deployment blocked",  active: "bg-red-700 border-red-600 text-white" },
                    { s: "P2", label: "P2 High",      desc: "4-hour SLA, significant impact",               active: "bg-yellow-700 border-yellow-600 text-white" },
                    { s: "P3", label: "P3 Medium",    desc: "24-hour SLA, limited impact",                  active: "bg-blue-800 border-blue-700 text-white" },
                  ].map(({ s, label, desc, active }) => (
                    <button key={s} onClick={() => setEscalateForm(p => ({ ...p, severity: s }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors text-center ${escalateForm.severity === s ? active : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"}`}>
                      {escalateForm.severity === s ? label : s}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {escalateForm.severity === "P1" ? "Critical: deployment fully blocked, immediate response required" : escalateForm.severity === "P2" ? "High impact: 4-hour response SLA, partial deployment" : "Medium impact: 24-hour response SLA, workaround available"}
                </p>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Description</label>
                <textarea rows={4} value={escalateForm.description} onChange={e => setEscalateForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the issue: affected systems, error messages, steps already attempted..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
              <button onClick={() => setShowEscalate(false)} className="flex-1 py-2 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors">Cancel</button>
              <button onClick={submitEscalation} disabled={!escalateForm.description.trim()}
                className="flex-1 py-2 text-sm font-semibold bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors">
                Submit Escalation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
