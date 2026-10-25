"use client";

import { motion } from "framer-motion";

import { locationFor } from "@/lib/nodes";
import type { IncidentSummary } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function IncidentStrip({
  incidents,
  activeId,
  onSelect,
}: {
  incidents: IncidentSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="strip">
      <div className="strip-head">
        <div className="eyebrow">Incident feed</div>
        <div className="strip-count">{incidents.length} reports</div>
      </div>
      <div className="strip-scroll">
        {incidents.length === 0 ? (
          <div className="strip-empty">No incidents yet — waiting for a node.</div>
        ) : (
          incidents.map((i) => {
            const loc = locationFor(i.node_id);
            return (
              <motion.button
                key={i.incident_id}
                className={`thumb ${i.incident_id === activeId ? "active" : ""}`}
                onClick={() => onSelect(i.incident_id)}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={i.image_url} alt="" />
                <div className="thumb-overlay">
                  <span className={`thumb-sev sev-${i.triage.severity}`} />
                </div>
                <div className="thumb-meta">
                  <div className="thumb-city">{loc.city.split(",")[0]}</div>
                  <div className="thumb-time">{timeAgo(i.received_at)} ago</div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </section>
  );
}
