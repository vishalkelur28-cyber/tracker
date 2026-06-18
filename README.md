# Falcon Provisioning Tracker

A full-featured customer onboarding and provisioning dashboard built with React, Tailwind CSS, and Recharts. Designed to reflect the real operational workflows a Provisioning Engineer runs when onboarding enterprise customers onto the CrowdStrike Falcon platform.

> **Disclaimer:** This is a personal portfolio project. It is not affiliated with, endorsed by, or connected to CrowdStrike, Inc. in any way. All customer data shown is entirely fictional and created for demonstration purposes.

---

## Live Demo

[View on Vercel](https://falcon-provisioning-tracker.vercel.app)

---

## Screenshots

> Add a screenshot here after deploying. A 1280x800 browser capture of the main dashboard works well.

---

## What This Project Demonstrates

This tool was built to showcase the skills most relevant to a Provisioning Engineer role at a cybersecurity-focused SaaS company:

**Domain knowledge:**
- Customer tenant lifecycle (kickoff through handoff to Customer Success)
- CID (Customer ID) management and tenant identity
- Sensor deployment workflows across Windows, Linux, macOS, and cloud workloads
- Policy enforcement modes (Alert Only vs. Prevention)
- Falcon module activation: EDR, Identity Threat Detection, Cloud Security (CWP), Spotlight, Fusion SOAR
- SIEM and ITSM integration tracking (Splunk, QRadar, Microsoft Sentinel, ServiceNow)
- P1/P2/P3 escalation workflows with SLA awareness
- Multi-region data residency (US-1, EU-1, US-GOV-1)

**Engineering skills:**
- React 18 with hooks (useState, useEffect, useRef, useCallback)
- Data-driven UI with real-time SLA countdown timers
- Recharts for workload visualisation (stacked bar chart)
- Pure SVG donut chart built from scratch (no chart library dependency)
- CSV export with full enriched data (coverage %, SLA breach flag, TTP)
- Keyboard shortcut system
- Responsive layout with Tailwind CSS utility classes

---

## Features

### Header
- **Live donut chart** showing tenant breakdown by status (Active / Pending / Under Review / Failed) with a total tenant count in the centre
- **Fleet KPI strip** showing total seats licensed, seats deployed, fleet-wide coverage %, average time-to-provision (TTP), and open escalation count
- **SLA breach indicator** in the header that pulses when any customer is overdue
- Export, Workload toggle, and keyboard shortcut help buttons

### At-Risk Banner
When one or more customers breach their SLA, a banner appears at the top of the dashboard with clickable chips per customer showing status and days overdue. Each chip navigates directly to that customer's side panel.

### Engineer Workload Dashboard
Toggle with the **Workload** button or press **W**. Shows:
- Per-engineer summary cards with customer count, open assignments, and total licensed seats
- Stacked bar chart (Recharts) breaking each engineer's workload by status

### Smart Search and Filters
- Full-text search across company name, CID, engineer name, industry, tier, and module names
- Independent dropdowns for Status, Tier, and Region
- Live counter showing filtered vs. total customers
- Clear all filters in one click

### Customer Table
Each row shows:
- Company name, CID (in monospace), and industry vertical
- Tier badge with region
- Seat coverage bar: deployed / licensed with percentage and colour coding (green 90%+, yellow 60-89%, red below 60%)
- Platform breakdown: Windows, Linux, macOS, and Cloud Workload counts
- Provisioning progress bar: steps complete out of 6, with percentage
- Status badge with SLA indicator: completed customers show TTP in days, in-progress customers show hours remaining or days overdue
- Sensor health percentage (check-in rate)
- Assigned engineer

### Side Panel (4 tabs)

**Steps tab** - Interactive provisioning checklist with 6 steps:
1. Account Created
2. Subscription Tier Activated
3. Endpoint Sensors Deployed
4. Admin Credentials Delivered
5. Prevention Policy Configured
6. Handoff to Customer Success

Each step records a timestamp and the engineer who completed it. Completing all steps automatically sets the customer to Active.

**Runbook tab** - Context-aware operational runbook. Highlights the next required action in amber. Each step is expandable, showing detailed numbered instructions referencing actual Falcon Console navigation paths, CLI commands, and process steps. Built from real provisioning knowledge.

**Details tab** - Full customer profile including:
- CID with click-to-copy (toast confirmation)
- Industry, region, SLA target, sensor version, policy mode
- Seat coverage bar
- Platform breakdown grid (Windows / Linux / macOS / Cloud)
- Sensor health percentage and check-in progress bar
- Detection summary: Critical / High / Medium counts post-deployment
- Module activation grid showing Active / Pending / N/A per Falcon module
- Integration status for SIEM, ITSM, and SOAR tools
- Open escalation history
- Engineer notes (freeform operational context per customer)

**Escalate tab** - Escalation form with:
- Issue type selector (Sensor Deployment, License Activation, Network Connectivity, and more)
- P1 / P2 / P3 severity selector with SLA descriptions
- Description field
- Escalation history for the customer showing all past escalations with severity, status, timestamp, and engineer
- Submitting sets customer status to Under Review and appends to the audit log

### Compliance Audit Log
Append-only log at the bottom of the page. Every checklist toggle and escalation submission is recorded with action, customer name, engineer, and timestamp.

### CSV Export
Exports the currently filtered set of customers to a dated CSV file. Columns include company, CID, tier, industry, region, status, engineer, coverage %, sensor health %, policy mode, progress %, TTP, SLA target date, and SLA breach flag.

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `/` | Focus the search bar |
| `Esc` | Close the side panel or any open modal |
| `W` | Toggle the workload dashboard |
| `?` | Open the keyboard shortcuts help modal |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI Framework | React 18 |
| Styling | Tailwind CSS 3 |
| Charts | Recharts 3 (bar chart), custom SVG (donut chart) |
| Build Tool | Vite 5 |
| Language | JavaScript (ESM) |
| Deployment | Vercel / GitHub Pages |

No backend. No database. All state is in-memory React state, which makes the entire app deployable as a static site.

---

## Local Setup

```bash
git clone https://github.com/vishalkelur28-cyber/falcon-provisioning-tracker.git
cd falcon-provisioning-tracker
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

```bash
npm run build    # production build
npm run preview  # preview the production build locally
```

---

## Project Structure

```
src/
  App.jsx        # entire application (single-file by design for portfolio clarity)
  index.css      # Tailwind directives + scrollbar styles
  main.jsx       # React DOM entry point
index.html
tailwind.config.js
vite.config.js
```

---

## Design Decisions

**Single-file architecture:** The entire application lives in `App.jsx`. For a portfolio project this is intentional: it makes the codebase easy to review in one pass, without jumping across folders. In a production codebase this would be split into feature modules.

**No mocked API layer:** All data is seeded as static initial state. The focus is on UI logic and domain modelling, not API integration. Adding a REST or GraphQL layer would be straightforward.

**Custom SVG donut chart:** The header donut uses a hand-rolled SVG implementation rather than Recharts PieChart, demonstrating understanding of SVG geometry (strokeDasharray, strokeDashoffset, coordinate transforms) without pulling in additional dependencies.

**SLA by tier:** Enterprise customers get a 7-day provisioning SLA, Pro 5 days, Go 3 days. These thresholds reflect realistic expectations for deployment complexity at each tier.

---

## Author

Built by [Your Name](https://github.com/vishalkelur28-cyber) as a portfolio project for a Provisioning Engineer application.
