"use client";

import { motion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { IncidentSummary, Severity } from "@/lib/types";

const COLORS: Record<Severity, string> = {
  low:      "#4ade80",
  medium:   "#fbbf24",
  high:     "#ff5756",
  critical: "#ef4444",
};

const LABELS: Record<Severity, string> = {
  low:      "Low",
  medium:   "Medium",
  high:     "High",
  critical: "Critical",
};

export function SeverityChart({ incidents }: { incidents: IncidentSummary[] }) {
  const counts: Record<Severity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const i of incidents) counts[i.triage.severity]++;

  const total = incidents.length;
  const data = (Object.keys(counts) as Severity[])
    .filter((k) => counts[k] > 0)
    .map((k) => ({ name: LABELS[k], value: counts[k], color: COLORS[k] }));

  const emptyData = [{ name: "none", value: 1, color: "#1f2635" }];
  const displayData = data.length > 0 ? data : emptyData;

  return (
    <motion.div
      className="severity-chart"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="eyebrow">Severity mix</div>
      <div className="chart-row">
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={displayData}
                dataKey="value"
                innerRadius="68%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                stroke="none"
                paddingAngle={2}
              >
                {displayData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-center">
            <div className="chart-total">{total}</div>
            <div className="chart-total-label">total</div>
          </div>
        </div>
        <div className="chart-legend">
          {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => {
            const pct = total > 0 ? Math.round((counts[sev] / total) * 100) : 0;
            return (
              <div key={sev} className="legend-row">
                <div className="legend-label">
                  <span className="legend-swatch" style={{ background: COLORS[sev] }} />
                  <span>{LABELS[sev]}</span>
                </div>
                <div className="legend-bar">
                  <motion.div
                    className="legend-bar-fill"
                    style={{ background: COLORS[sev] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
                <div className="legend-count">{counts[sev]}</div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
