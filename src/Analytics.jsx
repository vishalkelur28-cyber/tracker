import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import { TTP_HISTORY, SLA_COMPLIANCE, ESCALATION_TYPES, MONTHLY_VOLUME, ENGINEERS } from "./data";
import { coveragePct, progress, slaStatus, ttpDays, fmtNum, riskScore } from "./utils";

const CHART_COLORS = {
  enterprise: "#f87171",
  pro:        "#60a5fa",
  go:         "#34d399",
  compliant:  "#34d399",
  breached:   "#f87171",
  p1:         "#f87171",
  p2:         "#facc15",
  p3:         "#60a5fa",
  new:        "#818cf8",
  completed:  "#34d399",
};

function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-200 font-semibold mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color ?? p.fill }} className="leading-5">
          {p.name}: <span className="font-semibold">{typeof p.value === "number" && p.value % 1 !== 0 ? p.value.toFixed(1) + "d" : p.value}</span>
        </p>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4">
      <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-3xl font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function Analytics({ customers }) {
  // ── Compute live metrics from current customers ────────────────────────────
  const totalSeats    = customers.reduce((a, c) => a + c.seats.licensed, 0);
  const deployedSeats = customers.reduce((a, c) => a + c.seats.deployed, 0);
  const fleetCoverage = totalSeats ? Math.round((deployedSeats / totalSeats) * 100) : 0;

  const completed     = customers.filter(c => c.completedDate);
  const avgTTP        = completed.length
    ? (completed.reduce((a, c) => a + ttpDays(c), 0) / completed.length).toFixed(1)
    : null;

  const slaCompliantNow = customers.filter(c => {
    const sl = slaStatus(c);
    return sl.state === "completed" || sl.state === "ok";
  }).length;
  const slaRate = Math.round((slaCompliantNow / customers.length) * 100);

  const openEscs = customers.reduce((a, c) => a + c.escalations.filter(e => e.status === "Open").length, 0);

  const totalDetections = customers.reduce((a, c) => a + (c.detections?.total ?? 0), 0);
  const critDetections  = customers.reduce((a, c) => a + (c.detections?.critical ?? 0), 0);

  // ── Engineer performance table data ───────────────────────────────────────
  const engineerStats = ENGINEERS.map(eng => {
    const rows       = customers.filter(c => c.engineer === eng);
    const done       = rows.filter(c => c.status === "Active");
    const avgTTPEng  = done.length ? (done.reduce((a, c) => a + ttpDays(c), 0) / done.length).toFixed(1) : "—";
    const seats      = rows.reduce((a, c) => a + c.seats.licensed, 0);
    const escs       = rows.reduce((a, c) => a + c.escalations.filter(e => e.status === "Open").length, 0);
    const avgRisk    = rows.length ? Math.round(rows.reduce((a, c) => a + riskScore(c), 0) / rows.length) : 100;
    return { eng, total: rows.length, completed: done.length, avgTTP: avgTTPEng, seats, openEscs: escs, avgRisk };
  }).filter(r => r.total > 0);

  // ── Platform totals ────────────────────────────────────────────────────────
  const platformTotals = customers.reduce((acc, c) => {
    acc.windows += c.platforms.windows;
    acc.linux   += c.platforms.linux;
    acc.mac     += c.platforms.mac;
    acc.cloud   += c.platforms.cloud;
    return acc;
  }, { windows: 0, linux: 0, mac: 0, cloud: 0 });

  const platformPie = [
    { name: "Windows", value: platformTotals.windows, color: "#60a5fa" },
    { name: "Linux",   value: platformTotals.linux,   color: "#a78bfa" },
    { name: "macOS",   value: platformTotals.mac,     color: "#94a3b8" },
    { name: "Cloud",   value: platformTotals.cloud,   color: "#34d399" },
  ].filter(p => p.value > 0);

  // ── Tier distribution ──────────────────────────────────────────────────────
  const tierCounts = [
    { name: "Enterprise", value: customers.filter(c => c.tier === "Falcon Enterprise").length, color: "#f87171" },
    { name: "Pro",        value: customers.filter(c => c.tier === "Falcon Pro").length,        color: "#60a5fa" },
    { name: "Go",         value: customers.filter(c => c.tier === "Falcon Go").length,         color: "#34d399" },
  ].filter(t => t.value > 0);

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-lg font-bold text-white">Provisioning Analytics</h1>
        <p className="text-xs text-slate-500 mt-0.5">Historical performance metrics and current fleet health</p>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Fleet Coverage"   value={`${fleetCoverage}%`}        sub={`${fmtNum(deployedSeats)} / ${fmtNum(totalSeats)} seats`} color={fleetCoverage >= 90 ? "#34d399" : fleetCoverage >= 60 ? "#facc15" : "#f87171"} />
        <KpiCard label="Avg TTP"          value={avgTTP ? `${avgTTP}d` : "N/A"} sub="time to provision"                               color="#a78bfa" />
        <KpiCard label="SLA Compliance"   value={`${slaRate}%`}              sub={`${slaCompliantNow}/${customers.length} on track`}      color={slaRate >= 80 ? "#34d399" : "#facc15"} />
        <KpiCard label="Open Escalations" value={openEscs}                   sub="requiring resolution"                                 color={openEscs > 0 ? "#f87171" : "#34d399"} />
        <KpiCard label="Detections"       value={totalDetections}            sub={`${critDetections} critical`}                          color="#fb923c" />
        <KpiCard label="Active Tenants"   value={customers.filter(c => c.status === "Active").length} sub={`of ${customers.length} total`} color="#34d399" />
      </div>

      {/* ── Row 1: TTP trend + SLA compliance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Time-to-Provision Trend" subtitle="Average days to complete onboarding by tier (12-month)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={TTP_HISTORY} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} unit="d" />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="enterprise" name="Enterprise" stroke={CHART_COLORS.enterprise} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pro"        name="Pro"        stroke={CHART_COLORS.pro}        strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="go"         name="Go"         stroke={CHART_COLORS.go}         strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-5 justify-center mt-2">
            {[["Enterprise","#f87171"],["Pro","#60a5fa"],["Go","#34d399"]].map(([l,c]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ background: c }} />
                <span className="text-xs text-slate-400">{l}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="SLA Compliance History" subtitle="Customers provisioned on-time vs. breached (12-month)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={SLA_COMPLIANCE} barSize={12} barGap={2} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="compliant" name="On Time" stackId="a" fill={CHART_COLORS.compliant} />
              <Bar dataKey="breached"  name="Breached" stackId="a" fill={CHART_COLORS.breached} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-5 justify-center mt-2">
            {[["On Time","#34d399"],["Breached","#f87171"]].map(([l,c]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                <span className="text-xs text-slate-400">{l}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* ── Row 2: Volume + Escalation types ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Monthly Provisioning Volume" subtitle="New onboardings vs. completions (12-month)">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={MONTHLY_VOLUME} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="new"       name="New"       stroke="#818cf8" fill="#818cf820" strokeWidth={2} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="#34d399" fill="#34d39920" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-5 justify-center mt-2">
            {[["New","#818cf8"],["Completed","#34d399"]].map(([l,c]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ background: c }} />
                <span className="text-xs text-slate-400">{l}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Escalation Analysis" subtitle="Total escalations by issue type and severity (all-time)">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={ESCALATION_TYPES} layout="vertical" barSize={10} barGap={2} margin={{ top: 4, right: 8, bottom: 0, left: 10 }}>
              <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="type" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="p1" name="P1" stackId="a" fill={CHART_COLORS.p1} />
              <Bar dataKey="p2" name="P2" stackId="a" fill={CHART_COLORS.p2} />
              <Bar dataKey="p3" name="P3" stackId="a" fill={CHART_COLORS.p3} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-5 justify-center mt-2">
            {[["P1","#f87171"],["P2","#facc15"],["P3","#60a5fa"]].map(([l,c]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
                <span className="text-xs text-slate-400">{l}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* ── Row 3: Platform pie + Tier pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Platform Distribution" subtitle="Total deployed sensors across all tenants">
          <div className="flex items-center gap-6">
            <PieChart width={140} height={140}>
              <Pie data={platformPie} cx={65} cy={65} innerRadius={42} outerRadius={62} dataKey="value" paddingAngle={2}>
                {platformPie.map((p, i) => <Cell key={i} fill={p.color} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtNum(v)} contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
            <div className="space-y-2 flex-1">
              {platformPie.map(p => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-xs text-slate-400 flex-1">{p.name}</span>
                  <span className="text-xs font-semibold text-slate-200 tabular-nums">{fmtNum(p.value)}</span>
                  <span className="text-[10px] text-slate-600">
                    {Math.round((p.value / Object.values(platformTotals).reduce((a,b)=>a+b,0)) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Tier Distribution" subtitle="Customer breakdown by subscription tier">
          <div className="flex items-center gap-6">
            <PieChart width={140} height={140}>
              <Pie data={tierCounts} cx={65} cy={65} innerRadius={42} outerRadius={62} dataKey="value" paddingAngle={2}>
                {tierCounts.map((t, i) => <Cell key={i} fill={t.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
            <div className="space-y-2 flex-1">
              {tierCounts.map(t => (
                <div key={t.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                  <span className="text-xs text-slate-400 flex-1">{t.name}</span>
                  <span className="text-xs font-semibold text-slate-200 tabular-nums">{t.value}</span>
                  <span className="text-[10px] text-slate-600">{Math.round((t.value / customers.length) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Engineer performance table ── */}
      <ChartCard title="Engineer Performance Summary" subtitle="Current provisioning metrics per engineer">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {["Engineer", "Assigned", "Completed", "Avg TTP", "Open Escalations", "Avg Risk Score", "Total Seats"].map(h => (
                  <th key={h} className="text-left text-xs text-slate-400 uppercase tracking-wider py-2 pr-6 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {engineerStats.map(r => {
                const riskColor = r.avgRisk >= 80 ? "#34d399" : r.avgRisk >= 55 ? "#facc15" : r.avgRisk >= 30 ? "#fb923c" : "#f87171";
                return (
                  <tr key={r.eng} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-6">
                      <div className="text-sm font-medium text-slate-200">{r.eng}</div>
                    </td>
                    <td className="py-3 pr-6 text-slate-300 tabular-nums">{r.total}</td>
                    <td className="py-3 pr-6">
                      <span className="text-emerald-400 font-semibold tabular-nums">{r.completed}</span>
                      <span className="text-slate-600 text-xs ml-1">/ {r.total}</span>
                    </td>
                    <td className="py-3 pr-6 text-slate-300 tabular-nums font-mono text-xs">{r.avgTTP === "—" ? r.avgTTP : `${r.avgTTP}d`}</td>
                    <td className="py-3 pr-6">
                      <span className={`text-xs font-semibold ${r.openEscs > 0 ? "text-red-400" : "text-slate-500"}`}>{r.openEscs}</span>
                    </td>
                    <td className="py-3 pr-6">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${r.avgRisk}%`, background: riskColor }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: riskColor }}>{r.avgRisk}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-6 text-slate-400 tabular-nums text-xs">{fmtNum(r.seats)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

    </div>
  );
}
