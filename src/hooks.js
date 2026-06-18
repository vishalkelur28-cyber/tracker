import { useState, useEffect, useCallback, useMemo } from "react";
import { slaStatus, fmt } from "./utils";

// ── useLocalStorage ───────────────────────────────────────────────────────────
export function useLocalStorage(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initial;
    } catch {
      return initial;
    }
  });

  const setValue = useCallback((value) => {
    setState(prev => {
      const next = typeof value === "function" ? value(prev) : value;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);

  return [state, setValue];
}

// ── useNotifications ──────────────────────────────────────────────────────────
export function useNotifications(customers) {
  const [readIds, setReadIds] = useLocalStorage("cs-notif-read-v1", []);

  const notifications = useMemo(() => {
    const notifs = [];
    customers.forEach(c => {
      const sl = slaStatus(c);

      // SLA breach
      if (sl.state === "breached") {
        notifs.push({
          id:         `sla-${c.id}`,
          type:       "sla",
          title:      "SLA Breach",
          message:    `${c.company} is ${sl.overdueD}d overdue (${c.status})`,
          severity:   "critical",
          customerId: c.id,
          ts:         c.lastUpdated,
        });
      }

      // Low sensor health
      if (c.sensorHealth < 80 && c.seats.deployed > 0 && c.status !== "Active") {
        notifs.push({
          id:         `health-${c.id}`,
          type:       "health",
          title:      "Low Sensor Check-in",
          message:    `${c.company} health at ${c.sensorHealth}% (target 95%+)`,
          severity:   "warning",
          customerId: c.id,
          ts:         c.lastUpdated,
        });
      }

      // Open escalations
      c.escalations.filter(e => e.status === "Open").forEach(esc => {
        notifs.push({
          id:         `esc-${esc.id}`,
          type:       "escalation",
          title:      `${esc.severity} Escalation Open`,
          message:    `${c.company}: ${esc.type}`,
          severity:   esc.severity === "P1" ? "critical" : "warning",
          customerId: c.id,
          ts:         esc.ts,
        });
      });
    });
    return notifs.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  }, [customers]);

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length;
  const isRead      = id => readIds.includes(id);

  function markAllRead()  { setReadIds(notifications.map(n => n.id)); }
  function markRead(id)   { setReadIds(prev => prev.includes(id) ? prev : [...prev, id]); }

  return { notifications, unreadCount, isRead, markAllRead, markRead };
}
