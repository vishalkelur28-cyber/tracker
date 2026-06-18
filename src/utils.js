import { SLA_BY_TIER } from "./data";

export function fmt(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtNum(n) {
  return (n ?? 0).toLocaleString("en-US");
}

export function coveragePct(seats) {
  if (!seats?.licensed) return 0;
  return Math.round((seats.deployed / seats.licensed) * 100);
}

export function ttpDays(c) {
  if (!c.completedDate || !c.startDate) return null;
  return Math.round((new Date(c.completedDate) - new Date(c.startDate)) / 86400000);
}

export function slaTargetDate(c) {
  const days = SLA_BY_TIER[c.tier] ?? 5;
  return new Date(new Date(c.startDate).getTime() + days * 86400000);
}

export function slaStatus(c) {
  if (c.status === "Active") return { state: "completed", ttp: ttpDays(c) };
  const target = slaTargetDate(c);
  const diffMs = target - Date.now();
  const diffH  = diffMs / 3600000;
  if (diffMs > 0) return { state: "ok", hoursLeft: Math.round(diffH) };
  const overdueH = Math.abs(Math.round(diffH));
  return { state: "breached", overdueH, overdueD: Math.floor(overdueH / 24) };
}

export function progress(checklist) {
  const done = checklist.filter(i => i.checked).length;
  return { done, total: checklist.length, pct: Math.round((done / checklist.length) * 100) };
}

export function healthColor(pct) {
  if (pct >= 95) return "#34d399";
  if (pct >= 80) return "#facc15";
  return "#f87171";
}

export function coverageColor(pct) {
  if (pct >= 90) return "#34d399";
  if (pct >= 60) return "#facc15";
  return "#f87171";
}

// ── Risk Score (0–100, lower = more at risk) ──────────────────────────────────
export function riskScore(c) {
  if (c.status === "Active") return 100;

  const cvg       = coveragePct(c.seats);
  const sl        = slaStatus(c);
  const openEscs  = c.escalations.filter(e => e.status === "Open").length;

  let score = 0;

  // Sensor health 30 pts
  score += (c.sensorHealth / 100) * 30;

  // Seat coverage 25 pts
  score += (cvg / 100) * 25;

  // SLA headroom 20 pts — zero if breached
  if (sl.state === "ok") {
    const slaDays   = SLA_BY_TIER[c.tier] ?? 5;
    const fracLeft  = Math.min(1, sl.hoursLeft / (slaDays * 24));
    score += fracLeft * 20;
  }

  // Policy mode 15 pts
  if (c.policyMode === "Prevention")     score += 15;
  else if (c.policyMode === "Alert Only") score += 8;

  // No open escalations 10 pts
  score += Math.max(0, 10 - openEscs * 5);

  return Math.round(score);
}

export function riskLabel(score) {
  if (score >= 80) return { label: "Low",      color: "#34d399", bg: "bg-emerald-900/40 border-emerald-700/50 text-emerald-300" };
  if (score >= 55) return { label: "Medium",   color: "#facc15", bg: "bg-yellow-900/40 border-yellow-700/50 text-yellow-300"   };
  if (score >= 30) return { label: "High",     color: "#fb923c", bg: "bg-orange-900/40 border-orange-700/50 text-orange-300"   };
  return              { label: "Critical", color: "#f87171", bg: "bg-red-900/40 border-red-700/50 text-red-300"           };
}

// ── Print provisioning summary ────────────────────────────────────────────────
export function printCustomerSummary(c) {
  const { done, total, pct } = progress(c.checklist);
  const cvg = coveragePct(c.seats);
  const fmtDate = ts => ts ? new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Pending";

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Provisioning Summary - ${c.company}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:760px;margin:40px auto;color:#111;font-size:13px;line-height:1.5}
  h1{font-size:22px;font-weight:700;margin-bottom:2px}
  .sub{color:#666;font-size:12px;margin-bottom:4px}
  .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid}
  .badge-active{background:#d1fae5;color:#065f46;border-color:#6ee7b7}
  .badge-pending{background:#fef3c7;color:#92400e;border-color:#fcd34d}
  .badge-failed{background:#fee2e2;color:#991b1b;border-color:#fca5a5}
  .badge-review{background:#dbeafe;color:#1e40af;border-color:#93c5fd}
  section{margin-top:28px}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#888;border-bottom:1px solid #e5e7eb;padding-bottom:5px;margin-bottom:12px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px 32px}
  .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6;font-size:12px}
  .row span:first-child{color:#555}
  .row strong{color:#111}
  .step{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid #f3f4f6}
  .check{color:#059669;font-weight:700}.pend{color:#ccc}
  .step-meta{font-size:11px;color:#999;margin-top:2px}
  .esc{margin-top:8px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:6px;background:#fafafa}
  .esc-p1{border-color:#fca5a5;background:#fff5f5}
  .esc-p2{border-color:#fcd34d;background:#fffbeb}
  .sev{font-weight:700;font-size:11px}
  .sev-p1{color:#dc2626}.sev-p2{color:#d97706}.sev-p3{color:#2563eb}
  .notes{font-size:12px;color:#444;background:#f9fafb;padding:12px;border-radius:6px;border:1px solid #e5e7eb;line-height:1.7}
  .bar-wrap{height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;margin-top:4px}
  .bar{height:100%;border-radius:3px}
  footer{margin-top:48px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#aaa;display:flex;justify-content:space-between}
  @media print{body{margin:20px}}
</style></head><body>

<h1>${c.company}</h1>
<div class="sub">CID: <strong>${c.cid}</strong> &nbsp;|&nbsp; ${c.tier} &nbsp;|&nbsp; ${c.industry} &nbsp;|&nbsp; ${c.region}</div>
<div class="sub" style="margin-bottom:8px">Engineer: <strong>${c.engineer}</strong> &nbsp;|&nbsp; Report: ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</div>
<span class="badge badge-${c.status.toLowerCase().replace(" ","-")}">${c.status}</span>

<section>
  <h2>Provisioning Overview</h2>
  <div class="grid2">
    <div>
      <div class="row"><span>Steps Complete</span><strong>${done}/${total} (${pct}%)</strong></div>
      <div class="row"><span>Policy Mode</span><strong>${c.policyMode}</strong></div>
      <div class="row"><span>Sensor Version</span><strong>${c.sensorVersion ?? "Not deployed"}</strong></div>
    </div>
    <div>
      <div class="row"><span>Seat Coverage</span><strong>${c.seats.deployed.toLocaleString()} / ${c.seats.licensed.toLocaleString()} (${cvg}%)</strong></div>
      <div class="row"><span>Sensor Health</span><strong>${c.sensorHealth}% check-in</strong></div>
      <div class="row"><span>SLA Target</span><strong>${SLA_BY_TIER[c.tier]} days (${c.tier})</strong></div>
    </div>
  </div>
  <div style="margin-top:10px">
    <div style="display:flex;justify-content:space-between;font-size:11px;color:#888;margin-bottom:3px"><span>Provisioning progress</span><span>${pct}%</span></div>
    <div class="bar-wrap"><div class="bar" style="width:${pct}%;background:${pct===100?"#10b981":pct>=50?"#f59e0b":"#ef4444"}"></div></div>
  </div>
</section>

<section>
  <h2>Provisioning Checklist</h2>
  ${c.checklist.map((item,i) => `
  <div class="step">
    <span class="${item.checked?"check":"pend"}">${item.checked?"✓":"○"}</span>
    <div>
      <div style="font-weight:${item.checked?"600":"400"};${!item.checked?"color:#999":""}">${i+1}. ${item.label}</div>
      ${item.checked ? `<div class="step-meta">${fmtDate(item.timestamp)} &nbsp;|&nbsp; ${item.engineer}</div>` : `<div class="step-meta">Pending</div>`}
    </div>
  </div>`).join("")}
</section>

<section>
  <h2>Platform Deployment</h2>
  <div class="grid2">
    ${[["Windows",c.platforms.windows,"#3b82f6"],["Linux",c.platforms.linux,"#8b5cf6"],["macOS",c.platforms.mac,"#6b7280"],["Cloud Workloads",c.platforms.cloud,"#10b981"]]
      .map(([n,v,col]) => `<div class="row"><span>${n}</span><strong style="color:${col}">${v.toLocaleString()}</strong></div>`).join("")}
  </div>
</section>

${c.escalations.length > 0 ? `
<section>
  <h2>Escalation History</h2>
  ${c.escalations.map(e => `
  <div class="esc esc-${e.severity.toLowerCase()}">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span class="sev sev-${e.severity.toLowerCase()}">${e.severity}</span>
      <span style="font-weight:600">${e.type}</span>
      <span style="margin-left:auto;font-size:11px;color:${e.status==="Open"?"#dc2626":"#059669"}">${e.status}</span>
    </div>
    <div style="color:#444">${e.description}</div>
    <div style="font-size:11px;color:#999;margin-top:4px">${fmtDate(e.ts)} &nbsp;|&nbsp; ${e.engineer}</div>
  </div>`).join("")}
</section>` : ""}

${c.notes ? `
<section>
  <h2>Engineer Notes</h2>
  <div class="notes">${c.notes}</div>
</section>` : ""}

<footer>
  <span>Falcon Provisioning Tracker &nbsp;|&nbsp; Internal Use Only</span>
  <span>Generated: ${new Date().toLocaleString()}</span>
</footer>

</body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
