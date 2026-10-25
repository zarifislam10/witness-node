"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { IncidentStrip } from "@/components/IncidentStrip";
import { LatestIncident } from "@/components/LatestIncident";
import { SeverityChart } from "@/components/SeverityChart";
import { StatsBar } from "@/components/StatsBar";
import { TelemetryLog } from "@/components/TelemetryLog";
import { fetchIncidents } from "@/lib/api";
import type { IncidentSummary } from "@/lib/types";

const DeploymentMap = dynamic(() => import("@/components/DeploymentMap"), {
  ssr: false,
  loading: () => <div className="map-loading">loading map…</div>,
});

const POLL_MS = 3000;

export default function Dashboard() {
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [usingMock, setUsingMock] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clock, setClock] = useState<string>("");

  useEffect(() => {
    const tick = () => setClock(new Date().toUTCString().slice(17, 25));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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

  const activeIncident = useMemo(() => {
    if (incidents.length === 0) return null;
    return (selectedId && incidents.find((i) => i.incident_id === selectedId)) || incidents[0];
  }, [incidents, selectedId]);

  return (
    <main className="app">
      <motion.header
        className="header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="logo-badge">
          <span className="logo-mark">
            W<span className="logo-mark-dot" />
          </span>
          <span className="logo-text">Witness·Node</span>
        </div>
        <div className="meta">
          <span className={`pill ${usingMock ? "mock" : "live"}`}>
            <span className="dot" /> {usingMock ? "offline / mock" : "link established"}
          </span>
          <span className="dim">OPS · {clock || "--:--:--"} UTC</span>
        </div>
      </motion.header>

      <section className="grid-top">
        <StatsBar incidents={incidents} />
        <SeverityChart incidents={incidents} />
      </section>

      <section className="grid-main">
        <div className="map-panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">Deployment map</div>
              <div className="panel-title">Active beacons across the field</div>
            </div>
            <div className="panel-legend">
              <span><span className="legend-dot" style={{background:"#4ade80"}}/>low</span>
              <span><span className="legend-dot" style={{background:"#fbbf24"}}/>medium</span>
              <span><span className="legend-dot" style={{background:"#ff5555"}}/>high</span>
              <span><span className="legend-dot" style={{background:"#64748b"}}/>idle</span>
            </div>
          </div>
          <div className="map-wrap">
            <DeploymentMap incidents={incidents} />
          </div>
        </div>

        <div className="hero-panel">
          {!loaded ? (
            <div className="hero empty"><div className="hero-empty-title">Connecting to field nodes…</div></div>
          ) : (
            <LatestIncident incident={activeIncident} />
          )}
        </div>
      </section>

      <TelemetryLog incidents={incidents} />

      <IncidentStrip
        incidents={incidents}
        activeId={activeIncident?.incident_id ?? null}
        onSelect={setSelectedId}
      />
    </main>
  );
}
