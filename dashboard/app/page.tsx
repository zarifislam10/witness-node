"use client";

import { useEffect, useState } from "react";

import { IncidentCard } from "@/components/IncidentCard";
import { fetchIncidents } from "@/lib/api";
import type { IncidentSummary } from "@/lib/types";

const POLL_MS = 3000;

export default function Dashboard() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [usingMock, setUsingMock] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const { incidents, usingMock } = await fetchIncidents();
      if (!alive) return;
      setIncidents(incidents);
      setUsingMock(usingMock);
      setLoaded(true);
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const nodeCount = new Set(incidents.map((i) => i.node_id)).size;
  const survivors = incidents.reduce((s, i) => s + i.triage.survivors_detected, 0);
  const critical = incidents.filter((i) => i.triage.severity === "critical").length;

  return (
    <main className="app">
      <header className="header">
        <h1>WITNESS<span className="accent">·</span>NODE</h1>
        <div className="meta">
          <span className={`pill ${usingMock ? "mock" : "live"}`}>
            <span className="dot" /> {usingMock ? "mock data" : "live"}
          </span>
          <span>Command Center</span>
        </div>
      </header>

      <section className="stats">
        <div className="stat">
          <div className="label">Incidents</div>
          <div className="value">{incidents.length}</div>
        </div>
        <div className="stat">
          <div className="label">Nodes reporting</div>
          <div className="value">{nodeCount}</div>
        </div>
        <div className="stat">
          <div className="label">Survivors detected</div>
          <div className="value">{survivors}</div>
        </div>
        <div className="stat">
          <div className="label">Critical events</div>
          <div className="value">{critical}</div>
        </div>
      </section>

      <section className="feed">
        {!loaded ? (
          <div className="empty">Connecting to field nodes…</div>
        ) : incidents.length === 0 ? (
          <div className="empty">No incidents yet. Waiting for a node to trigger.</div>
        ) : (
          incidents.map((i) => <IncidentCard key={i.incident_id} incident={i} />)
        )}
      </section>
    </main>
  );
}
