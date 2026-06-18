// ── Domain constants ──────────────────────────────────────────────────────────
export const ENGINEERS   = ["Priya Mehta", "James Okafor", "Sofia Reyes", "Vishal Arora", "Natalie Chen"];
export const SLA_BY_TIER = { "Falcon Enterprise": 7, "Falcon Pro": 5, "Falcon Go": 3 };
export const STATUSES    = ["Active", "Pending", "Under Review", "Failed"];
export const TIERS       = ["Falcon Enterprise", "Falcon Pro", "Falcon Go"];
export const REGIONS     = ["All Regions", "US-East", "US-West", "EU-West", "APAC"];

// ── Style maps ────────────────────────────────────────────────────────────────
export const STATUS_META = {
  Active:        { ring: "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50", dot: "bg-emerald-400", color: "#34d399" },
  Pending:       { ring: "bg-yellow-900/40 text-yellow-300 border border-yellow-700/50",   dot: "bg-yellow-400",  color: "#facc15" },
  Failed:        { ring: "bg-red-900/40 text-red-400 border border-red-700/50",             dot: "bg-red-500",     color: "#f87171" },
  "Under Review":{ ring: "bg-blue-900/40 text-blue-300 border border-blue-700/50",         dot: "bg-blue-400",    color: "#60a5fa" },
};

export const TIER_CLS = {
  "Falcon Enterprise": "text-red-400 font-semibold",
  "Falcon Pro":        "text-slate-300 font-medium",
  "Falcon Go":         "text-slate-400",
};

export const TIER_BADGE = {
  "Falcon Enterprise": "bg-red-950/50 text-red-400 border-red-800/50",
  "Falcon Pro":        "bg-slate-800/60 text-slate-300 border-slate-600/50",
  "Falcon Go":         "bg-slate-800/40 text-slate-400 border-slate-700/50",
};

export const POLICY_CLS = {
  "Prevention":     "text-emerald-400 bg-emerald-950/40 border-emerald-700/40",
  "Alert Only":     "text-yellow-400 bg-yellow-950/40 border-yellow-700/40",
  "Not Configured": "text-red-400 bg-red-950/40 border-red-700/40",
};

export const INTEG_META = {
  Active:  { cls: "text-emerald-400", icon: "✓" },
  Pending: { cls: "text-yellow-400",  icon: "◌" },
  Failed:  { cls: "text-red-400",     icon: "✗" },
  "N/A":   { cls: "text-slate-600",   icon: "N/A" },
};

export const MOD_META = {
  Active:  "text-emerald-400",
  Pending: "text-yellow-400",
  "N/A":   "text-slate-600",
};

// ── Runbook ───────────────────────────────────────────────────────────────────
export const RUNBOOK = {
  acc: [
    "Log in to Falcon Console > Support > Customer Tenants",
    "Click '+ New Tenant', enter company legal name, address, and POC email",
    "Assign provisioning engineer and account manager to the tenant record",
    "Confirm CID (Customer ID) is auto-generated (format: 32-char hex)",
    "Set tenant region to match data residency requirements (US-1 / EU-1 / US-GOV-1)",
    "Send CID + onboarding welcome email to customer POC via secure channel",
  ],
  sub: [
    "Open the customer tenant > Billing > Subscriptions > Manage",
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
    "For SSO customers: configure SAML IdP in Authentication > SSO settings first",
    "Generate time-limited invite link (expires in 24h); never reuse old links",
    "Deliver link exclusively via approved secure channel (1Password / ProtonMail / encrypted Slack DM)",
    "Confirm customer: clicked link, set a strong password, and enabled MFA (TOTP or hardware key)",
    "For API access: create an OAuth2 API client (read scopes only), deliver client_id + secret securely",
    "Revoke all temporary provisioning tokens once customer confirms successful login",
  ],
  pol: [
    "Configuration > Prevention Policies > Clone the '[BASELINE] Customer Onboarding' template",
    "Rename policy to match customer company name + tier (e.g. 'Northrop-Enterprise-Prevention')",
    "Set enforcement mode: Alert Only for Week 1, switch to Prevention after customer sign-off",
    "Tune ML sensor detection level: Aggressive (Enterprise), Moderate (Pro), Conservative (Go)",
    "Enable process blocking exclusions for known customer software (AV, backup agents, dev tools)",
    "Apply Identity-based policy if ITD module is contracted (Configuration > Identity Protection)",
    "Assign the policy to the customer host group; confirm propagation in ~2 min",
    "Schedule a policy review call with customer Security team at Day 7 post-deployment",
  ],
  hand: [
    "Verify all 5 prior checklist steps are marked complete in the provisioning tracker",
    "Confirm sensor check-in rate is 95%+ and zero P0/P1 unresolved detections",
    "Generate provisioning completion report: CID, seats, coverage %, TTP, escalation summary",
    "Book 30-min handoff call with CSM, share report, walkthrough Falcon console live",
    "Transfer Salesforce opportunity to 'Live Customer' record type, assign to CSM",
    "Create the customer's first scheduled Threat Hunting task in Falcon Overwatch",
    "Set Day-30 / Day-90 / QBR check-in dates in CSM calendar",
    "Close Jira provisioning epic; archive all provisioning artifacts in SharePoint",
  ],
};

// ── Customer seed data ────────────────────────────────────────────────────────
export const INITIAL_CUSTOMERS = [
  {
    id: 1, company: "Northrop Grumman Corporation", cid: "CID-NGBI-A847F2",
    tier: "Falcon Enterprise", industry: "Defense & Aerospace", region: "US-East",
    features: ["Falcon Prevent", "Identity Threat Detection", "Threat Intelligence", "Falcon Fusion", "Falcon Discover"],
    status: "Active", engineer: "Priya Mehta",
    startDate: "2024-06-10T09:00:00Z", lastUpdated: "2024-06-14T10:22:00Z", completedDate: "2024-06-14T10:22:00Z",
    seats: { licensed: 12500, deployed: 12500 },
    platforms: { windows: 8400, linux: 3200, mac: 900, cloud: 480 },
    sensorVersion: "7.14.17004.0", policyMode: "Prevention", sensorHealth: 99.7,
    detections: { critical: 2, high: 8, medium: 16, total: 26 },
    integrations: [
      { name: "Splunk SIEM", status: "Active" }, { name: "ServiceNow ITSM", status: "Active" },
      { name: "Falcon Fusion SOAR", status: "Active" }, { name: "Palo Alto XSOAR", status: "N/A" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)", status: "Active" }, { name: "Falcon Identity Threat Detection", status: "Active" },
      { name: "Falcon Intelligence", status: "Active" }, { name: "Falcon Fusion SOAR", status: "Active" },
      { name: "Falcon Discover", status: "Active" }, { name: "Falcon Spotlight", status: "N/A" },
    ],
    notes: "Customer uses Jamf for Mac management; sensor pushed via Jamf MDM profile. Linux servers provisioned via Ansible playbook provided by customer IT. API client (read-only) created for Splunk HEC integration. MFA enforced via Okta SSO.",
    escalations: [],
    checklist: [
      { id: "acc",  label: "Account Created",              checked: true,  timestamp: "2024-06-10T09:00:00Z", engineer: "Priya Mehta" },
      { id: "sub",  label: "Subscription Tier Activated",  checked: true,  timestamp: "2024-06-10T10:30:00Z", engineer: "Priya Mehta" },
      { id: "sen",  label: "Endpoint Sensors Deployed",    checked: true,  timestamp: "2024-06-11T14:00:00Z", engineer: "Priya Mehta" },
      { id: "cred", label: "Admin Credentials Delivered",  checked: true,  timestamp: "2024-06-11T16:00:00Z", engineer: "Priya Mehta" },
      { id: "pol",  label: "Prevention Policy Configured", checked: true,  timestamp: "2024-06-12T11:00:00Z", engineer: "Priya Mehta" },
      { id: "hand", label: "Handoff to Customer Success",  checked: true,  timestamp: "2024-06-14T10:22:00Z", engineer: "Priya Mehta" },
    ],
  },
  {
    id: 2, company: "JPMorgan Chase & Co.", cid: "CID-JPMC-C391D5",
    tier: "Falcon Enterprise", industry: "Financial Services", region: "US-East",
    features: ["Falcon Prevent", "Cloud Security", "Zero Trust Assessment", "Threat Intelligence"],
    status: "Pending", engineer: "James Okafor",
    startDate: "2024-06-14T09:00:00Z", lastUpdated: "2024-06-15T08:45:00Z", completedDate: null,
    seats: { licensed: 28000, deployed: 11900 },
    platforms: { windows: 9200, linux: 2400, mac: 300, cloud: 1240 },
    sensorVersion: "7.14.17004.0", policyMode: "Alert Only", sensorHealth: 91.4,
    detections: { critical: 0, high: 3, medium: 7, total: 10 },
    integrations: [
      { name: "Splunk SIEM", status: "Pending" }, { name: "ServiceNow ITSM", status: "Active" },
      { name: "Falcon Fusion SOAR", status: "Pending" }, { name: "AWS Security Hub", status: "Pending" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)", status: "Active" }, { name: "Falcon Cloud Security (CWP)", status: "Pending" },
      { name: "Falcon Zero Trust Assessment", status: "Pending" }, { name: "Falcon Intelligence", status: "Active" },
      { name: "Falcon Discover", status: "Pending" }, { name: "Falcon Identity Threat Detection", status: "Pending" },
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
    id: 3, company: "Lockheed Martin Corporation", cid: "CID-LKMT-B217E8",
    tier: "Falcon Pro", industry: "Defense & Aerospace", region: "US-East",
    features: ["Falcon Prevent", "Threat Intelligence", "Falcon Spotlight"],
    status: "Under Review", engineer: "Sofia Reyes",
    startDate: "2024-06-13T09:00:00Z", lastUpdated: "2024-06-15T13:10:00Z", completedDate: null,
    seats: { licensed: 8700, deployed: 4100 },
    platforms: { windows: 3800, linux: 290, mac: 10, cloud: 0 },
    sensorVersion: "7.13.16803.0", policyMode: "Alert Only", sensorHealth: 72.1,
    detections: { critical: 1, high: 4, medium: 9, total: 14 },
    integrations: [
      { name: "Microsoft Sentinel", status: "Pending" }, { name: "ServiceNow ITSM", status: "Active" },
      { name: "Falcon Fusion SOAR", status: "N/A" }, { name: "Splunk SIEM", status: "N/A" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)", status: "Active" }, { name: "Falcon Intelligence", status: "Active" },
      { name: "Falcon Spotlight (VM)", status: "Pending" }, { name: "Falcon Discover", status: "N/A" },
    ],
    notes: "Escalation raised: sensor check-in rate at 47% (target 95%+). Root cause under investigation; customer IT suspects GPO conflict with existing DLP agent. Credentials delivery blocked pending ISSO approval process. Sensor version pinned to 7.13.x per customer change freeze.",
    escalations: [
      { id: "esc-1", ts: "2024-06-15T11:00:00Z", type: "Sensor Deployment", severity: "P2",
        description: "Sensor check-in rate stuck at 47%. GPO conflict suspected with Forcepoint DLP agent on Windows endpoints.",
        status: "Open", engineer: "Sofia Reyes" },
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
    id: 4, company: "Goldman Sachs Group, Inc.", cid: "CID-GLDM-F059A1",
    tier: "Falcon Enterprise", industry: "Financial Services", region: "US-East",
    features: ["Falcon Prevent", "Cloud Security", "Identity Threat Detection", "Zero Trust Assessment", "Threat Intelligence"],
    status: "Failed", engineer: "Natalie Chen",
    startDate: "2024-06-12T09:00:00Z", lastUpdated: "2024-06-13T17:30:00Z", completedDate: null,
    seats: { licensed: 15200, deployed: 0 },
    platforms: { windows: 0, linux: 0, mac: 0, cloud: 0 },
    sensorVersion: null, policyMode: "Not Configured", sensorHealth: 0,
    detections: { critical: 0, high: 0, medium: 0, total: 0 },
    integrations: [
      { name: "Splunk SIEM", status: "Failed" }, { name: "Goldman GS360", status: "Failed" },
      { name: "ServiceNow ITSM", status: "Pending" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)", status: "Pending" }, { name: "Falcon Cloud Security (CWP)", status: "Pending" },
      { name: "Falcon Identity Threat Detection", status: "Pending" }, { name: "Falcon Zero Trust Assessment", status: "Pending" },
      { name: "Falcon Intelligence", status: "Pending" },
    ],
    notes: "CRITICAL: Sensor deployment blocked. Customer IT firewall blocking outbound traffic to ts01-b.cloudsink.net:443 (Falcon sensor comms). Network change request submitted by customer (CHG-0048821), ETA: 5 business days. No sensors checking in. CID created but unusable until firewall resolved.",
    escalations: [
      { id: "esc-1", ts: "2024-06-13T17:30:00Z", type: "Network Connectivity", severity: "P1",
        description: "All sensor deployment attempts failed. Firewall blocking Falcon backend (ts01-b.cloudsink.net:443). No hosts checking in.",
        status: "Open", engineer: "Natalie Chen" },
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
    id: 5, company: "Boeing Defense & Space", cid: "CID-BONG-D743C6",
    tier: "Falcon Pro", industry: "Defense & Aerospace", region: "US-West",
    features: ["Falcon Prevent", "Falcon Spotlight", "Threat Intelligence"],
    status: "Active", engineer: "Vishal Arora",
    startDate: "2024-06-08T09:00:00Z", lastUpdated: "2024-06-12T12:00:00Z", completedDate: "2024-06-12T12:00:00Z",
    seats: { licensed: 9800, deployed: 9741 },
    platforms: { windows: 7200, linux: 1900, mac: 641, cloud: 0 },
    sensorVersion: "7.14.17004.0", policyMode: "Prevention", sensorHealth: 98.3,
    detections: { critical: 0, high: 2, medium: 11, total: 13 },
    integrations: [
      { name: "QRadar SIEM", status: "Active" }, { name: "ServiceNow ITSM", status: "Active" },
      { name: "Falcon Fusion SOAR", status: "N/A" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)", status: "Active" }, { name: "Falcon Intelligence", status: "Active" },
      { name: "Falcon Spotlight (VM)", status: "Active" }, { name: "Falcon Discover", status: "N/A" },
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
    id: 6, company: "Pfizer Inc.", cid: "CID-PFIZ-A122B9",
    tier: "Falcon Go", industry: "Pharmaceuticals", region: "EU-West",
    features: ["Falcon Prevent", "Falcon Discover"],
    status: "Pending", engineer: "James Okafor",
    startDate: "2024-06-15T07:00:00Z", lastUpdated: "2024-06-15T07:00:00Z", completedDate: null,
    seats: { licensed: 3200, deployed: 120 },
    platforms: { windows: 120, linux: 0, mac: 0, cloud: 0 },
    sensorVersion: "7.14.17004.0", policyMode: "Alert Only", sensorHealth: 100,
    detections: { critical: 0, high: 0, medium: 0, total: 0 },
    integrations: [
      { name: "Microsoft Sentinel", status: "Pending" }, { name: "ServiceNow ITSM", status: "Pending" },
    ],
    modules: [
      { name: "Falcon Prevent (EDR)", status: "Active" }, { name: "Falcon Discover", status: "Pending" },
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

export const INITIAL_AUDIT = [
  { id: 1, ts: "2024-06-14T10:22:00Z", action: "Handoff to Customer Success completed",              customer: "Northrop Grumman Corporation", engineer: "Priya Mehta"  },
  { id: 2, ts: "2024-06-13T17:30:00Z", action: "Escalation [P1] raised: firewall blocking Falcon comms", customer: "Goldman Sachs Group, Inc.",    engineer: "Natalie Chen" },
  { id: 3, ts: "2024-06-13T15:00:00Z", action: "Endpoint Sensors Deployed checked",                  customer: "Lockheed Martin Corporation",  engineer: "Sofia Reyes"  },
  { id: 4, ts: "2024-06-12T12:00:00Z", action: "Handoff to Customer Success completed",              customer: "Boeing Defense & Space",        engineer: "Vishal Arora" },
];

// ── Analytics historical data ─────────────────────────────────────────────────
export const TTP_HISTORY = [
  { month: "Jul 23", enterprise: 8.2, pro: 5.1, go: 2.9 },
  { month: "Aug 23", enterprise: 7.8, pro: 4.8, go: 3.1 },
  { month: "Sep 23", enterprise: 9.1, pro: 5.5, go: 2.7 },
  { month: "Oct 23", enterprise: 7.2, pro: 4.2, go: 2.5 },
  { month: "Nov 23", enterprise: 6.8, pro: 4.6, go: 3.0 },
  { month: "Dec 23", enterprise: 7.5, pro: 5.0, go: 2.8 },
  { month: "Jan 24", enterprise: 8.0, pro: 4.9, go: 2.6 },
  { month: "Feb 24", enterprise: 6.5, pro: 4.3, go: 2.4 },
  { month: "Mar 24", enterprise: 7.1, pro: 4.7, go: 2.9 },
  { month: "Apr 24", enterprise: 6.9, pro: 4.4, go: 2.7 },
  { month: "May 24", enterprise: 5.8, pro: 4.1, go: 2.5 },
  { month: "Jun 24", enterprise: 4.7, pro: 4.1, go: 3.2 },
];

export const SLA_COMPLIANCE = [
  { month: "Jul 23", compliant: 4, breached: 2 },
  { month: "Aug 23", compliant: 5, breached: 1 },
  { month: "Sep 23", compliant: 3, breached: 3 },
  { month: "Oct 23", compliant: 6, breached: 0 },
  { month: "Nov 23", compliant: 5, breached: 2 },
  { month: "Dec 23", compliant: 4, breached: 1 },
  { month: "Jan 24", compliant: 6, breached: 2 },
  { month: "Feb 24", compliant: 5, breached: 1 },
  { month: "Mar 24", compliant: 7, breached: 1 },
  { month: "Apr 24", compliant: 6, breached: 2 },
  { month: "May 24", compliant: 8, breached: 1 },
  { month: "Jun 24", compliant: 4, breached: 2 },
];

export const ESCALATION_TYPES = [
  { type: "Sensor Deploy",    p1: 3, p2: 8, p3: 5 },
  { type: "Network",          p1: 4, p2: 3, p3: 2 },
  { type: "License",          p1: 1, p2: 4, p3: 6 },
  { type: "Policy Config",    p1: 0, p2: 5, p3: 8 },
  { type: "Credentials",      p1: 1, p2: 3, p3: 4 },
  { type: "Integration",      p1: 2, p2: 6, p3: 3 },
];

export const MONTHLY_VOLUME = [
  { month: "Jul 23", new: 5, completed: 4 },
  { month: "Aug 23", new: 6, completed: 5 },
  { month: "Sep 23", new: 4, completed: 3 },
  { month: "Oct 23", new: 7, completed: 7 },
  { month: "Nov 23", new: 6, completed: 5 },
  { month: "Dec 23", new: 3, completed: 4 },
  { month: "Jan 24", new: 8, completed: 6 },
  { month: "Feb 24", new: 6, completed: 5 },
  { month: "Mar 24", new: 9, completed: 8 },
  { month: "Apr 24", new: 8, completed: 7 },
  { month: "May 24", new: 10, completed: 9 },
  { month: "Jun 24", new: 6, completed: 4 },
];
