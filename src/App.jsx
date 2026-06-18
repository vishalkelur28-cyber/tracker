import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  ENGINEERS, SLA_BY_TIER, STATUSES, TIERS, REGIONS, RUNBOOK,
  INITIAL_CUSTOMERS, INITIAL_AUDIT,
  STATUS_META, TIER_CLS, TIER_BADGE, POLICY_CLS, INTEG_META, MOD_META,
} from "./data";
import {
  fmt, fmtNum, coveragePct, progress, slaStatus, ttpDays,
  healthColor, coverageColor, riskScore, riskLabel, printCustomerSummary,
} from "./utils";
import { useLocalStorage, useNotifications } from "./hooks";
import Analytics from "./Analytics";

// ── DonutChart ────────────────────────────────────────────────────────────────
function DonutChart({ segments, size = 80, thickness = 10 }) {
  const r = (size - thickness) / 2 - 1, cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <svg width={size} height={size}><circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={thickness} /></svg>;
  let offset = 0;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * C;
        const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={thickness} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset} />;
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// ── SLABadge ──────────────────────────────────────────────────────────────────
function SLABadge({ customer }) {
  const s = slaStatus(customer);
  if (s.state === "completed")
    return <span className="text-xs px-1.5 py-0.5 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 rounded font-mono">✓ {s.ttp}d TTP</span>;
  if (s.state === "breached")
    return <span className="text-xs px-1.5 py-0.5 bg-red-950/60 border border-red-700/60 text-red-400 rounded font-mono animate-pulse">⚠ {s.overdueD}d overdue</span>;
  const urgency = s.hoursLeft < 24 ? "text-orange-400 border-orange-700/60 bg-orange-950/40" : "text-slate-400 border-slate-700/40 bg-slate-800/40";
  return <span className={`text-xs px-1.5 py-0.5 border rounded font-mono ${urgency}`}>{s.hoursLeft}h left</span>;
}

// ── PlatformBar ───────────────────────────────────────────────────────────────
function PlatformBar({ platforms }) {
  const items = [
    { key: "windows", label: "Win", color: "#60a5fa" },
    { key: "linux",   label: "Lnx", color: "#a78bfa" },
    { key: "mac",     label: "Mac", color: "#94a3b8" },
    { key: "cloud",   label: "Cld", color: "#34d399" },
  ].filter(i => platforms[i.key] > 0);
  if (!items.length) return <span className="text-xs text-slate-600">No sensors</span>;
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

// ── RiskBadge ─────────────────────────────────────────────────────────────────
function RiskBadge({ score }) {
  const r = riskLabel(score);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: r.color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color: r.color }}>{score}</span>
    </div>
  );
}

// ── TableSkeleton ─────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {Array(6).fill(0).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-slate-800/40 items-center">
          <div className="space-y-1.5 flex-1">
            <div className="h-3.5 bg-slate-700/60 rounded w-44" />
            <div className="h-2 bg-slate-800/60 rounded w-28" />
          </div>
          <div className="h-3 bg-slate-700/60 rounded w-20" />
          <div className="h-3 bg-slate-700/60 rounded w-24" />
          <div className="h-2 bg-slate-700/60 rounded-full w-28" />
          <div className="h-5 bg-slate-700/60 rounded-full w-16" />
          <div className="h-3 bg-slate-700/60 rounded w-10" />
          <div className="h-3 bg-slate-700/60 rounded w-14" />
        </div>
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
      {payload.map(p => <p key={p.name} style={{ color: p.fill }} className="leading-5">{p.name}: <span className="font-semibold">{p.value}</span></p>)}
    </div>
  );
}

// ── NotificationCenter ────────────────────────────────────────────────────────
function NotificationCenter({ notifications, unreadCount, isRead, markAllRead, markRead, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function click(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const TYPE_META = {
    sla:        { icon: "⚠", bg: "bg-red-900/40 border-red-800/50",    dot: "bg-red-500"    },
    health:     { icon: "♥", bg: "bg-yellow-900/40 border-yellow-800/50", dot: "bg-yellow-500" },
    escalation: { icon: "▲", bg: "bg-orange-900/40 border-orange-800/50", dot: "bg-orange-500" },
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(p => !p)}
        className="relative w-8 h-8 flex items-center justify-center bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors">
        <span className="text-slate-400 text-sm">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">Notifications</span>
              {unreadCount > 0 && <span className="text-xs bg-red-900/50 text-red-400 border border-red-700/50 px-1.5 py-0.5 rounded-full">{unreadCount} new</span>}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Mark all read</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">No notifications</div>
            ) : notifications.map(n => {
              const meta = TYPE_META[n.type] ?? TYPE_META.sla;
              const read = isRead(n.id);
              return (
                <div key={n.id}
                  onClick={() => { markRead(n.id); onNavigate(n.customerId); setOpen(false); }}
                  className={`px-4 py-3 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/50 transition-colors flex gap-3 ${read ? "opacity-40" : ""}`}
                >
                  <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs border ${meta.bg}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-200">{n.title}</span>
                      {!read && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{n.message}</p>
                    <p className="text-[10px] text-slate-600 mt-0.5 font-mono">{fmt(n.ts)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
        <div key={step.id} className={`rounded-lg border overflow-hidden ${step.checked ? "border-emerald-800/30" : step.id === nextStep?.id ? "border-amber-600/50" : "border-slate-700/40"}`}>
          <button onClick={() => setOpen(open === step.id ? null : step.id)}
            className={`w-full px-3 py-2.5 flex items-center gap-2.5 text-left transition-colors ${step.checked ? "bg-emerald-950/20" : step.id === nextStep?.id ? "bg-amber-950/30" : "bg-slate-800/30 hover:bg-slate-800/50"}`}>
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
  const Row = ({ label, value, mono }) => (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs text-slate-200 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
  return (
    <div className="p-4 space-y-5">
      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Tenant Identity</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">CID</span>
            <button onClick={() => onCopyCID(customer.cid)} className="flex items-center gap-1.5 text-xs font-mono text-slate-200 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 transition-colors" title="Click to copy">
              {customer.cid} <span className="text-slate-500 text-[10px]">⎘</span>
            </button>
          </div>
          <Row label="Industry"    value={customer.industry} />
          <Row label="Region"      value={customer.region} />
          <Row label="SLA Target"  value={`${SLA_BY_TIER[customer.tier]}d (${customer.tier})`} />
          {customer.sensorVersion && <Row label="Sensor Ver." value={customer.sensorVersion} mono />}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Policy Mode</span>
            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${POLICY_CLS[customer.policyMode]}`}>{customer.policyMode}</span>
          </div>
        </div>
      </section>

      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Seat Coverage</p>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">{fmtNum(customer.seats.deployed)} / {fmtNum(customer.seats.licensed)} deployed</span>
          <span className="text-xs font-bold tabular-nums" style={{ color: coverageColor(cvg) }}>{cvg}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cvg}%`, background: coverageColor(cvg) }} />
        </div>
      </section>

      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Platforms</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[["Windows","windows","#60a5fa"],["Linux","linux","#a78bfa"],["macOS","mac","#94a3b8"],["Cloud","cloud","#34d399"]].map(([n,k,c]) => (
            <div key={k} className="flex items-center justify-between px-2 py-1.5 bg-slate-800/50 rounded border border-slate-700/40">
              <span className="text-xs text-slate-400">{n}</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: c }}>{fmtNum(customer.platforms[k])}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Sensor Health</p>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">Check-in rate</span>
          <span className="text-xs font-bold" style={{ color: healthColor(customer.sensorHealth) }}>{customer.sensorHealth}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-3">
          <div className="h-full rounded-full" style={{ width: `${customer.sensorHealth}%`, background: healthColor(customer.sensorHealth) }} />
        </div>
        {customer.detections.total > 0 && (
          <div className="grid grid-cols-4 gap-1 text-center">
            {[["Crit",customer.detections.critical,"#f87171"],["High",customer.detections.high,"#fb923c"],["Med",customer.detections.medium,"#facc15"],["Total",customer.detections.total,"#94a3b8"]].map(([l,v,c]) => (
              <div key={l} className="bg-slate-800/50 rounded border border-slate-700/40 py-1.5">
                <div className="text-sm font-bold" style={{ color: c }}>{v}</div>
                <div className="text-[10px] text-slate-500">{l}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Modules</p>
        <div className="space-y-1.5">
          {customer.modules.map(m => (
            <div key={m.name} className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
              <span className="text-xs text-slate-400 leading-snug">{m.name}</span>
              <span className={`text-xs font-medium ${MOD_META[m.status]}`}>{m.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Integrations</p>
        <div className="space-y-1.5">
          {customer.integrations.map(intg => {
            const meta = INTEG_META[intg.status];
            return (
              <div key={intg.name} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{intg.name}</span>
                <span className={`text-xs font-medium flex items-center gap-1 ${meta.cls}`}>{meta.icon} {intg.status}</span>
              </div>
            );
          })}
        </div>
      </section>

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

      {customer.notes && (
        <section>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2 font-semibold">Engineer Notes</p>
          <p className="text-xs text-slate-400 leading-relaxed bg-slate-800/40 rounded-lg p-3 border border-slate-700/40">{customer.notes}</p>
        </section>
      )}

      <button onClick={() => printCustomerSummary(customer)}
        className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs rounded-lg transition-colors flex items-center justify-center gap-2">
        <span>⎙</span> Print Provisioning Summary
      </button>
    </div>
  );
}

// ── BulkActionBar ─────────────────────────────────────────────────────────────
function BulkActionBar({ count, onReassign, onExport, onClear }) {
  const [showReassign, setShowReassign] = useState(false);
  if (count === 0) return null;
  return (
    <div className="sticky top-20 z-10 mx-0 px-4 py-2.5 bg-indigo-950/90 border border-indigo-700/60 rounded-lg backdrop-blur flex items-center gap-3">
      <span className="text-xs font-semibold text-indigo-300">{count} customer{count !== 1 ? "s" : ""} selected</span>
      <div className="flex items-center gap-2 ml-auto">
        <div className="relative">
          <button onClick={() => setShowReassign(p => !p)}
            className="px-3 py-1.5 text-xs bg-indigo-900/60 hover:bg-indigo-800/60 border border-indigo-700/50 text-indigo-300 rounded-lg transition-colors">
            Reassign Engineer
          </button>
          {showReassign && (
            <div className="absolute right-0 top-8 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden w-44">
              {ENGINEERS.map(eng => (
                <button key={eng} onClick={() => { onReassign(eng); setShowReassign(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors">
                  {eng}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onExport} className="px-3 py-1.5 text-xs bg-indigo-900/60 hover:bg-indigo-800/60 border border-indigo-700/50 text-indigo-300 rounded-lg transition-colors">
          Export Selected
        </button>
        <button onClick={onClear} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-colors">
          Clear
        </button>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [customers, setCustomers]         = useLocalStorage("cs-tracker-v2-customers", null);
  const [auditLog, setAuditLog]           = useLocalStorage("cs-tracker-v2-audit", INITIAL_AUDIT);
  const [loading, setLoading]             = useState(!customers);
  const [apiError, setApiError]           = useState(null);
  const [page, setPage]                   = useState("dashboard");
  const [selected, setSelected]           = useState(null);
  const [activeTab, setActiveTab]         = useState("checklist");
  const [showEscalate, setShowEscalate]   = useState(false);
  const [escalateForm, setEscalateForm]   = useState({ type: "Sensor Deployment", severity: "P2", description: "" });
  const [currentEngineer]                 = useState("Vishal Arora");
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState("All");
  const [filterTier, setFilterTier]       = useState("All");
  const [filterRegion, setFilterRegion]   = useState("All Regions");
  const [showWorkload, setShowWorkload]   = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [myQueue, setMyQueue]             = useState(false);
  const [sortBy, setSortBy]               = useState("default");
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const [copiedCID, setCopiedCID]         = useState(null);
  const searchRef = useRef(null);

  const effectiveCustomers = customers ?? INITIAL_CUSTOMERS;
  const { notifications, unreadCount, isRead, markAllRead, markRead } = useNotifications(effectiveCustomers);

  // initial API simulation
  useEffect(() => {
    if (customers) return;
    const t = setTimeout(() => {
      setCustomers(INITIAL_CUSTOMERS);
      setLoading(false);
    }, 1200 + Math.random() * 500);
    return () => clearTimeout(t);
  }, []);

  // manual sync
  function handleSync() {
    setLoading(true);
    setApiError(null);
    setTimeout(() => {
      if (Math.random() < 0.15) {
        setApiError("Connection to falcon-api.crowdstrike.com timed out.");
        setLoading(false);
        return;
      }
      setLoading(false);
    }, 1000 + Math.random() * 800);
  }

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
        if (e.key === "Escape") e.target.blur();
        return;
      }
      if (e.key === "/")                 { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape")            { showEscalate ? setShowEscalate(false) : setSelected(null); }
      if (e.key === "w" || e.key === "W") setShowWorkload(p => !p);
      if (e.key === "?")                  setShowShortcuts(p => !p);
      if (e.key === "m" || e.key === "M") setMyQueue(p => !p);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEscalate]);

  function handleCopyCID(cid) {
    navigator.clipboard?.writeText(cid).catch(() => {});
    setCopiedCID(cid);
    setTimeout(() => setCopiedCID(null), 2000);
  }

  // derived + filtered + sorted
  const atRisk = effectiveCustomers.filter(c => slaStatus(c).state === "breached");

  const filtered = useMemo(() => effectiveCustomers.filter(c => {
    const q   = search.toLowerCase();
    const hit = !q || c.company.toLowerCase().includes(q) || c.engineer.toLowerCase().includes(q)
      || c.tier.toLowerCase().includes(q) || c.cid.toLowerCase().includes(q)
      || c.industry.toLowerCase().includes(q) || c.features.some(f => f.toLowerCase().includes(q));
    return hit
      && (filterStatus === "All" || c.status === filterStatus)
      && (filterTier === "All" || c.tier === filterTier)
      && (filterRegion === "All Regions" || c.region === filterRegion)
      && (!myQueue || c.engineer === currentEngineer);
  }), [effectiveCustomers, search, filterStatus, filterTier, filterRegion, myQueue]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === "risk")     return list.sort((a, b) => riskScore(a) - riskScore(b));
    if (sortBy === "coverage") return list.sort((a, b) => coveragePct(a.seats) - coveragePct(b.seats));
    if (sortBy === "sla")      return list.sort((a, b) => {
      const sa = slaStatus(a), sb = slaStatus(b);
      if (sa.state === "breached" && sb.state !== "breached") return -1;
      if (sb.state === "breached" && sa.state !== "breached") return 1;
      return 0;
    });
    return list;
  }, [filtered, sortBy]);

  const stats = {
    total:       effectiveCustomers.length,
    active:      effectiveCustomers.filter(c => c.status === "Active").length,
    pending:     effectiveCustomers.filter(c => c.status === "Pending").length,
    failed:      effectiveCustomers.filter(c => c.status === "Failed").length,
    underReview: effectiveCustomers.filter(c => c.status === "Under Review").length,
    totalSeats:  effectiveCustomers.reduce((a, c) => a + c.seats.licensed, 0),
    deployed:    effectiveCustomers.reduce((a, c) => a + c.seats.deployed, 0),
  };

  const fleetCoverage = stats.totalSeats ? Math.round((stats.deployed / stats.totalSeats) * 100) : 0;
  const avgTTP = (() => {
    const done = effectiveCustomers.filter(c => c.completedDate);
    return done.length ? (done.reduce((a, c) => a + ttpDays(c), 0) / done.length).toFixed(1) : null;
  })();

  const donutSegments = [
    { label: "Active",       value: stats.active,      color: "#34d399" },
    { label: "Pending",      value: stats.pending,     color: "#facc15" },
    { label: "Under Review", value: stats.underReview, color: "#60a5fa" },
    { label: "Failed",       value: stats.failed,      color: "#f87171" },
  ].filter(s => s.value > 0);

  const workloadData = ENGINEERS.map(eng => {
    const rows = effectiveCustomers.filter(c => c.engineer === eng);
    return {
      name:          eng.split(" ")[0],
      Active:        rows.filter(c => c.status === "Active").length,
      Pending:       rows.filter(c => c.status === "Pending").length,
      "Under Review":rows.filter(c => c.status === "Under Review").length,
      Failed:        rows.filter(c => c.status === "Failed").length,
    };
  }).filter(d => d.Active + d.Pending + d["Under Review"] + d.Failed > 0);

  const sel = effectiveCustomers.find(c => c.id === selected);

  function addLog(action, company, eng) {
    setAuditLog(prev => [{ id: Date.now(), ts: new Date().toISOString(), action, customer: company, engineer: eng }, ...prev]);
  }

  function toggleCheck(customerId, checkId) {
    setCustomers(prev => (prev ?? INITIAL_CUSTOMERS).map(c => {
      if (c.id !== customerId) return c;
      const newChecklist = c.checklist.map(item => {
        if (item.id !== checkId) return item;
        const now = !item.checked;
        addLog(`${item.label} ${now ? "checked" : "unchecked"}`, c.company, currentEngineer);
        return { ...item, checked: now, timestamp: now ? new Date().toISOString() : null, engineer: now ? currentEngineer : null };
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
    setCustomers(prev => (prev ?? INITIAL_CUSTOMERS).map(c => {
      if (c.id !== selected) return c;
      const newEsc = { id: `esc-${Date.now()}`, ts: new Date().toISOString(), type: escalateForm.type, severity: escalateForm.severity, description: escalateForm.description, status: "Open", engineer: currentEngineer };
      return { ...c, status: "Under Review", lastUpdated: new Date().toISOString(), escalations: [...c.escalations, newEsc] };
    }));
    setEscalateForm({ type: "Sensor Deployment", severity: "P2", description: "" });
    setShowEscalate(false);
  }

  function exportCSV(rows = sorted) {
    const headers = ["Company","CID","Tier","Industry","Region","Status","Engineer","Coverage %","Sensor Health","Policy Mode","Progress %","TTP Days","SLA Breach","Risk Score"];
    const data = rows.map(c => {
      const { pct } = progress(c.checklist);
      const sl = slaStatus(c);
      return [c.company,c.cid,c.tier,c.industry,c.region,c.status,c.engineer,coveragePct(c.seats),c.sensorHealth,c.policyMode,pct,ttpDays(c)??"",sl.state==="breached"?`Yes (${sl.overdueD}d)`:"No",riskScore(c)];
    });
    const csv = [headers,...data].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    Object.assign(document.createElement("a"),{href:url,download:`provisioning-${new Date().toISOString().slice(0,10)}.csv`}).click();
    URL.revokeObjectURL(url);
  }

  function bulkReassign(engineer) {
    setCustomers(prev => (prev ?? INITIAL_CUSTOMERS).map(c => {
      if (!selectedIds.has(c.id)) return c;
      addLog(`Reassigned to ${engineer}`, c.company, currentEngineer);
      return { ...c, engineer, lastUpdated: new Date().toISOString() };
    }));
    setSelectedIds(new Set());
  }

  function bulkExport() {
    exportCSV(effectiveCustomers.filter(c => selectedIds.has(c.id)));
    setSelectedIds(new Set());
  }

  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === sorted.length ? new Set() : new Set(sorted.map(c => c.id)));
  }

  function toggleSelectOne(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const activeFilters = search || filterStatus !== "All" || filterTier !== "All" || filterRegion !== "All Regions" || myQueue;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">

      {/* ── Header ── */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-5 justify-between">
          {/* brand + nav */}
          <div className="flex items-center gap-5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center shadow-lg shadow-red-900/50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm tracking-widest">CROWDSTRIKE</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-red-900/50 border border-red-700/50 text-red-400 rounded font-mono tracking-wider">PROVISIONING</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Customer Provisioning Tracker</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/50 rounded-lg p-1">
              {[["dashboard","Dashboard"],["analytics","Analytics"]].map(([p,l]) => (
                <button key={p} onClick={() => setPage(p)}
                  className={`px-3 py-1 text-xs rounded font-medium transition-colors ${page === p ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* donut */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <DonutChart segments={donutSegments} size={72} thickness={10} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-white font-bold text-sm leading-none">{stats.total}</div>
                  <div className="text-slate-500 text-[10px] mt-0.5">tenants</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
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
          <div className="hidden xl:flex items-center gap-0 bg-slate-800/60 border border-slate-700/50 rounded-xl divide-x divide-slate-700/50">
            {[
              { label: "Coverage",     value: `${fleetCoverage}%`,              color: fleetCoverage >= 90 ? "#34d399" : "#facc15" },
              { label: "Total Seats",  value: fmtNum(stats.totalSeats),         color: "#94a3b8" },
              { label: "Deployed",     value: fmtNum(stats.deployed),           color: "#60a5fa" },
              { label: "Avg TTP",      value: avgTTP ? `${avgTTP}d` : "N/A",   color: "#a78bfa" },
              { label: "Escalations",  value: effectiveCustomers.reduce((a,c)=>a+c.escalations.filter(e=>e.status==="Open").length,0), color: "#f87171" },
            ].map(kpi => (
              <div key={kpi.label} className="flex flex-col items-center px-3 py-1.5">
                <span className="text-sm font-bold tabular-nums leading-none" style={{ color: kpi.color }}>{kpi.value}</span>
                <span className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">{kpi.label}</span>
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
            <NotificationCenter
              notifications={notifications} unreadCount={unreadCount}
              isRead={isRead} markAllRead={markAllRead} markRead={markRead}
              onNavigate={id => { setSelected(id); setActiveTab("checklist"); setPage("dashboard"); }}
            />
            <button onClick={handleSync} disabled={loading}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {loading ? <span className="w-3 h-3 border border-slate-500 border-t-slate-300 rounded-full animate-spin" /> : "↻"} Sync
            </button>
            <button onClick={() => setShowWorkload(p => !p)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${showWorkload ? "bg-indigo-900/40 border-indigo-600/50 text-indigo-300" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"}`}>
              Workload
            </button>
            <button onClick={() => exportCSV()}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors">
              ↓ CSV
            </button>
            <button onClick={() => setShowShortcuts(p => !p)}
              className="w-7 h-7 flex items-center justify-center text-xs bg-slate-800 border border-slate-700 text-slate-500 rounded-lg hover:text-slate-300 transition-colors">?</button>
            <div className="w-px h-5 bg-slate-700/80" />
            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-300 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">{currentEngineer}</span>
              <span className="text-[10px] text-slate-600 mt-0.5">Provisioning Engineer</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── CID copy toast ── */}
      {copiedCID && (
        <div className="fixed top-16 right-6 z-50 px-3 py-2 bg-emerald-900/90 border border-emerald-700/50 text-emerald-300 text-xs rounded-lg shadow-xl">
          ✓ Copied: {copiedCID}
        </div>
      )}

      {/* ── API error banner ── */}
      {apiError && (
        <div className="max-w-screen-2xl mx-auto px-6 pt-4">
          <div className="px-4 py-3 bg-red-950/50 border border-red-800/50 rounded-lg flex items-center gap-3">
            <span className="text-red-400">✗</span>
            <span className="text-xs text-red-300 flex-1">{apiError}</span>
            <button onClick={() => { setApiError(null); handleSync(); }} className="text-xs text-red-400 hover:text-red-200 border border-red-700/50 px-2.5 py-1 rounded-lg transition-colors">Retry</button>
            <button onClick={() => setApiError(null)} className="text-slate-500 hover:text-slate-300 text-lg leading-none">×</button>
          </div>
        </div>
      )}

      {/* ── Analytics page ── */}
      {page === "analytics" && <Analytics customers={effectiveCustomers} />}

      {/* ── Dashboard ── */}
      {page === "dashboard" && (
        <div className="max-w-screen-2xl mx-auto px-6 py-5 space-y-4">

          {/* At-risk banner */}
          {atRisk.length > 0 && (
            <div className="px-4 py-3 bg-red-950/50 border border-red-800/50 rounded-xl flex items-start gap-3">
              <div className="shrink-0 w-8 h-8 bg-red-900/50 border border-red-700/50 rounded-lg flex items-center justify-center text-red-400 mt-0.5">⚠</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-300">SLA Breach Alert: {atRisk.length} customer{atRisk.length !== 1 ? "s" : ""} overdue</p>
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

          {/* Workload dashboard */}
          {showWorkload && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Engineer Workload Dashboard</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Open provisioning assignments by status per engineer</p>
                </div>
                <button onClick={() => setShowWorkload(false)} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
              </div>
              <div className="grid grid-cols-5 gap-3 mb-4">
                {ENGINEERS.map(eng => {
                  const rows = effectiveCustomers.filter(c => c.engineer === eng);
                  const open = rows.filter(c => c.status !== "Active").length;
                  return (
                    <div key={eng} className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-slate-200">{eng.split(" ")[0]}</p>
                      <p className="text-[10px] text-slate-500 mb-2">{eng.split(" ")[1]}</p>
                      <div className="flex items-end justify-between">
                        <div><div className="text-lg font-bold text-white">{rows.length}</div><div className="text-[10px] text-slate-500">customers</div></div>
                        <div className="text-right"><div className="text-sm font-semibold" style={{ color: open > 0 ? "#facc15" : "#34d399" }}>{open}</div><div className="text-[10px] text-slate-500">open</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={workloadData} barSize={20} barCategoryGap="40%">
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={20} />
                  <Tooltip content={<WorkloadTooltip />} cursor={{ fill: "rgba(148,163,184,0.04)" }} />
                  <Bar dataKey="Active"       stackId="a" fill="#34d399" />
                  <Bar dataKey="Pending"      stackId="a" fill="#facc15" />
                  <Bar dataKey="Under Review" stackId="a" fill="#60a5fa" />
                  <Bar dataKey="Failed"       stackId="a" fill="#f87171" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Search + filters + sort */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-64 max-w-lg">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">⌕</span>
              <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder='Search company, CID, engineer, industry… ("/")'
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-8 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500 transition-colors" />
              {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-base">×</button>}
            </div>
            {[
              { value: filterStatus, set: setFilterStatus, opts: ["All", ...STATUSES] },
              { value: filterTier,   set: setFilterTier,   opts: ["All", ...TIERS] },
              { value: filterRegion, set: setFilterRegion, opts: REGIONS },
            ].map((f, i) => (
              <select key={i} value={f.value} onChange={e => f.set(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-slate-500 cursor-pointer">
                {f.opts.map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:border-slate-500 cursor-pointer">
              <option value="default">Sort: Default</option>
              <option value="risk">Sort: Risk (worst first)</option>
              <option value="coverage">Sort: Coverage (lowest first)</option>
              <option value="sla">Sort: SLA (breached first)</option>
            </select>
            <button onClick={() => setMyQueue(p => !p)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${myQueue ? "bg-indigo-900/40 border-indigo-600/50 text-indigo-300" : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"}`}>
              {myQueue ? "My Queue ×" : "My Queue (M)"}
            </button>
            {activeFilters && (
              <button onClick={() => { setSearch(""); setFilterStatus("All"); setFilterTier("All"); setFilterRegion("All Regions"); setMyQueue(false); setSortBy("default"); }}
                className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 transition-colors">
                Clear all
              </button>
            )}
            <span className="text-xs text-slate-500 ml-auto whitespace-nowrap">{sorted.length} / {effectiveCustomers.length} customers</span>
          </div>

          {/* Bulk action bar */}
          <BulkActionBar count={selectedIds.size} onReassign={bulkReassign} onExport={bulkExport} onClear={() => setSelectedIds(new Set())} />

          {/* Main content */}
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                {loading ? (
                  <div>
                    <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50 flex items-center gap-2">
                      <div className="w-4 h-3 bg-slate-700/60 rounded animate-pulse" />
                      <div className="flex gap-4 flex-1">
                        {Array(7).fill(0).map((_,i) => <div key={i} className="h-3 bg-slate-700/40 rounded animate-pulse" style={{width:`${60+i*10}px`}} />)}
                      </div>
                    </div>
                    <TableSkeleton />
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-800/50">
                        <th className="px-3 py-3">
                          <input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === sorted.length} onChange={toggleSelectAll}
                            className="w-4 h-4 accent-indigo-500 cursor-pointer" />
                        </th>
                        {["Customer / CID","Tier","Seat Coverage","Platforms","Progress","Status / SLA","Risk","Engineer"].map(h => (
                          <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider px-3 py-3 font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-sm">No customers match your filters</td></tr>
                      ) : sorted.map(c => {
                        const { done, total, pct } = progress(c.checklist);
                        const cvg  = coveragePct(c.seats);
                        const sl   = slaStatus(c);
                        const rs   = riskScore(c);
                        const barC = pct === 100 ? "#34d399" : pct >= 50 ? "#facc15" : "#f87171";
                        const isSelected = selectedIds.has(c.id);
                        return (
                          <tr key={c.id} className={`border-b border-slate-800/40 transition-colors ${selected === c.id ? "bg-slate-800/80" : isSelected ? "bg-indigo-950/30" : "hover:bg-slate-800/40"}`}>
                            <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSelectOne(c.id)} className="w-4 h-4 accent-indigo-500 cursor-pointer" />
                            </td>
                            <td className="px-3 py-3 cursor-pointer" onClick={() => { setSelected(c.id); setActiveTab("checklist"); }}>
                              <div className="flex items-start gap-2">
                                {c.escalations.some(e => e.status === "Open") && <span className="text-red-400 text-xs shrink-0 mt-0.5">●</span>}
                                <div className="min-w-0">
                                  <div className="font-semibold text-white text-sm leading-snug truncate max-w-[180px]">{c.company}</div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-mono text-slate-500">{c.cid}</span>
                                    <span className="text-[10px] text-slate-600">·</span>
                                    <span className="text-[10px] text-slate-500">{c.industry}</span>
                                  </div>
                                  {sl.state === "breached" && <span className="text-[10px] text-red-400 font-medium">{sl.overdueD}d SLA breach</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 cursor-pointer" onClick={() => { setSelected(c.id); setActiveTab("checklist"); }}>
                              <span className={`text-xs px-2 py-0.5 rounded border ${TIER_BADGE[c.tier]}`}>{c.tier.replace("Falcon ","")}</span>
                              <div className="text-[10px] text-slate-500 mt-1">{c.region}</div>
                            </td>
                            <td className="px-3 py-3 w-32 cursor-pointer" onClick={() => { setSelected(c.id); setActiveTab("checklist"); }}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-400 tabular-nums">{fmtNum(c.seats.deployed)}<span className="text-slate-600">/{fmtNum(c.seats.licensed)}</span></span>
                                <span className="text-xs font-semibold tabular-nums" style={{ color: coverageColor(cvg) }}>{cvg}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${cvg}%`, background: coverageColor(cvg) }} />
                              </div>
                            </td>
                            <td className="px-3 py-3 cursor-pointer" onClick={() => { setSelected(c.id); setActiveTab("checklist"); }}>
                              <PlatformBar platforms={c.platforms} />
                            </td>
                            <td className="px-3 py-3 w-28 cursor-pointer" onClick={() => { setSelected(c.id); setActiveTab("checklist"); }}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-slate-400 tabular-nums">{done}/{total}</span>
                                <span className="text-xs font-semibold tabular-nums" style={{ color: barC }}>{pct}%</span>
                              </div>
                              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barC }} />
                              </div>
                            </td>
                            <td className="px-3 py-3 cursor-pointer" onClick={() => { setSelected(c.id); setActiveTab("checklist"); }}>
                              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_META[c.status].ring}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[c.status].dot}`} />{c.status}
                              </span>
                              <div className="mt-1.5"><SLABadge customer={c} /></div>
                            </td>
                            <td className="px-3 py-3 w-24 cursor-pointer" onClick={() => { setSelected(c.id); setActiveTab("checklist"); }}>
                              <RiskBadge score={rs} />
                              <div className="text-[10px] text-slate-600 mt-0.5">{riskLabel(rs).label}</div>
                            </td>
                            <td className="px-3 py-3 cursor-pointer" onClick={() => { setSelected(c.id); setActiveTab("checklist"); }}>
                              <div className="text-xs text-slate-300">{c.engineer.split(" ")[0]}</div>
                              <div className="text-[10px] text-slate-500">{c.engineer.split(" ")[1]}</div>
                              <div className="text-[10px] text-slate-600 mt-0.5">{fmt(c.lastUpdated)}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Audit Log */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />Compliance Audit Log
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

            {/* Side Panel */}
            {sel && (
              <div className="w-[340px] shrink-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden self-start sticky top-20">
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
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[sel.status].dot}`} />{sel.status}
                    </span>
                    <SLABadge customer={sel} />
                    <span className={`text-xs px-2 py-0.5 rounded border ${riskLabel(riskScore(sel)).bg}`}>
                      Risk {riskScore(sel)}
                    </span>
                    {sel.escalations.some(e => e.status === "Open") && (
                      <span className="text-xs px-2 py-0.5 bg-red-900/40 border border-red-700/40 text-red-400 rounded-full">
                        {sel.escalations.filter(e => e.status === "Open").length} escalation
                      </span>
                    )}
                  </div>
                  {(() => {
                    const { done, total, pct } = progress(sel.checklist);
                    const cvg = coveragePct(sel.seats);
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>Steps</span><span className="font-semibold text-slate-300">{done}/{total}</span></div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? "#34d399" : "#f59e0b" }} /></div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>Coverage</span><span className="font-semibold" style={{ color: coverageColor(cvg) }}>{cvg}%</span></div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${cvg}%`, background: coverageColor(cvg) }} /></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex border-b border-slate-800">
                  {[["checklist","Steps"],["runbook","Runbook"],["details","Details"],["escalate","Escalate"]].map(([tab,label]) => (
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
                            <p className={`text-xs font-medium leading-snug ${item.checked ? "text-emerald-300 line-through" : "text-slate-200"}`}>{idx + 1}. {item.label}</p>
                            {item.checked && <p className="text-xs text-slate-500 mt-0.5">{fmt(item.timestamp)} · {item.engineer}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === "runbook"  && <RunbookPanel customer={sel} />}
                  {activeTab === "details"  && <DetailsPanel customer={sel} onCopyCID={handleCopyCID} />}
                  {activeTab === "escalate" && (
                    <div className="p-4 space-y-3">
                      <button onClick={() => setShowEscalate(true)}
                        className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                        <span>⚠</span> Escalate to Engineering
                      </button>
                      <p className="text-xs text-slate-500 text-center">Status will change to Under Review</p>
                      {sel.escalations.length > 0 && (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Escalation History</p>
                          {sel.escalations.map(esc => (
                            <div key={esc.id} className="p-3 bg-red-950/30 border border-red-800/40 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs font-bold ${esc.severity==="P1"?"text-red-400":esc.severity==="P2"?"text-yellow-400":"text-blue-400"}`}>{esc.severity}</span>
                                <span className="text-xs text-slate-300">{esc.type}</span>
                                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${esc.status==="Open"?"text-red-400 border-red-700/50 bg-red-950/40":"text-emerald-400 border-emerald-700/50 bg-emerald-950/40"}`}>{esc.status}</span>
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
      )}

      {/* Shortcuts modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold text-sm">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-3">
              {[["/" ,"Focus search"],[" Esc","Close panel / modal"],["W","Toggle workload"],["M","Toggle my queue"],["?","This help"]].map(([k,d]) => (
                <div key={k} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-400">{d}</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded font-mono shrink-0">{k}</kbd>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-4 pt-4 border-t border-slate-800">Click any CID to copy it to clipboard.</p>
          </div>
        </div>
      )}

      {/* Escalation modal */}
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
                <select value={escalateForm.type} onChange={e => setEscalateForm(p => ({...p,type:e.target.value}))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500">
                  {["Sensor Deployment","License Activation","Credential Issue","Policy Configuration","Integration Failure","Network Connectivity","CID / Tenant Issue","Module Activation"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Severity</label>
                <div className="flex gap-2">
                  {[{s:"P1",a:"bg-red-700 border-red-600"},{s:"P2",a:"bg-yellow-700 border-yellow-600"},{s:"P3",a:"bg-blue-800 border-blue-700"}].map(({s,a}) => (
                    <button key={s} onClick={() => setEscalateForm(p => ({...p,severity:s}))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${escalateForm.severity===s?`${a} text-white`:"bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"}`}>{s}</button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {escalateForm.severity==="P1"?"Critical: deployment fully blocked, immediate response required":escalateForm.severity==="P2"?"High impact: 4-hour response SLA, partial deployment":"Medium impact: 24-hour response SLA, workaround available"}
                </p>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5 uppercase tracking-wider">Description</label>
                <textarea rows={4} value={escalateForm.description} onChange={e => setEscalateForm(p => ({...p,description:e.target.value}))}
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
