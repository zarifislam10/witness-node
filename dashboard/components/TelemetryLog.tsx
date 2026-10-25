"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { IncidentSummary } from "@/lib/types";

interface LogEntry {
  id: string;
  ts: string;
  tag: string;
  message: string;
  tone: "info" | "ok" | "warn" | "crit";
}

function hhmmss(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function entriesFor(incident: IncidentSummary): LogEntry[] {
  const base = incident.received_at;
  const ts = hhmmss(base);
  const sev = incident.triage.severity;
  const sevTone: LogEntry["tone"] =
    sev === "critical" ? "crit" : sev === "high" ? "warn" : "ok";

  return [
    {
      id: `${incident.incident_id}-trigger`,
      ts,
      tag: incident.node_id.toUpperCase(),
      message: `${incident.trigger} trigger detected`,
      tone: "info",
    },
    {
      id: `${incident.incident_id}-photo`,
      ts,
      tag: incident.node_id.toUpperCase(),
      message: "photo captured · uploading to backend",
      tone: "info",
    },
    {
      id: `${incident.incident_id}-gemini`,
      ts,
      tag: "GEMINI",
      message: `triage ${sev.toUpperCase()} · ${incident.triage.survivors_detected} survivor(s)`,
      tone: sevTone,
    },
    {
      id: `${incident.incident_id}-elevenlabs`,
      ts,
      tag: "ELEVEN",
      message: "voice synthesis complete",
      tone: "ok",
    },
    {
      id: `${incident.incident_id}-solana`,
      ts,
      tag: "SOLANA",
      message: incident.solana_tx
        ? `tx confirmed · ${incident.solana_tx.slice(0, 10)}…`
        : "tx pending",
      tone: incident.solana_tx ? "ok" : "warn",
    },
  ];
}

export function TelemetryLog({ incidents }: { incidents: IncidentSummary[] }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const newEntries: LogEntry[] = [];
    for (const inc of [...incidents].reverse()) {
      for (const e of entriesFor(inc)) {
        if (!seen.current.has(e.id)) {
          seen.current.add(e.id);
          newEntries.push(e);
        }
      }
    }
    if (newEntries.length) {
      setEntries((prev) => [...prev, ...newEntries].slice(-120));
    }
  }, [incidents]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  return (
    <aside className="telemetry">
      <div className="telemetry-head">
        <span className="dot" /> TELEMETRY CONSOLE
      </div>
      <div className="telemetry-body" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <motion.div
              key={e.id}
              className={`log-line tone-${e.tone}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
            >
              <span className="log-ts">[{e.ts}]</span>
              <span className="log-tag">{e.tag}</span>
              <span className="log-msg">{e.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {entries.length === 0 && (
          <div className="log-line tone-info">
            <span className="log-ts">—</span>
            <span className="log-msg">awaiting field activity…</span>
          </div>
        )}
      </div>
    </aside>
  );
}
