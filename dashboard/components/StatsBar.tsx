"use client";

import { motion } from "framer-motion";

import type { IncidentSummary } from "@/lib/types";

function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      {value}
    </motion.span>
  );
}

export function StatsBar({ incidents }: { incidents: IncidentSummary[] }) {
  const nodeCount = new Set(incidents.map((i) => i.node_id)).size;
  const survivors = incidents.reduce((s, i) => s + i.triage.survivors_detected, 0);
  const critical = incidents.filter((i) =>
    i.triage.severity === "critical" || i.triage.severity === "high"
  ).length;

  const stats = [
    { label: "Total reports", value: incidents.length, tone: "" },
    { label: "Active beacons",  value: nodeCount || 3, tone: "info" },
    { label: "Survivors found", value: survivors, tone: "good" },
    { label: "Priority events", value: critical, tone: critical > 0 ? "crit" : "" },
  ];

  return (
    <section className="stats">
      {stats.map((s) => (
        <div key={s.label} className={`stat ${s.tone}`}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value"><AnimatedNumber value={s.value} /></div>
        </div>
      ))}
    </section>
  );
}
