"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchIncidents } from "@/lib/api";
import { toFMIncidents, type FMIncident, type FMSeverity } from "@/lib/adapter";
import { locationFor } from "@/lib/nodes";

const RealMap = dynamic(() => import("./RealMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#8a9bac", fontSize: 11 }}>
      loading field map…
    </div>
  ),
});

const POLL_MS = 3000;

const severityColor: Record<FMSeverity, string> = {
  LOW: "#22d3ee",
  MED: "#ffd93d",
  HIGH: "#ff2d55",
};

// CONUS approximate bounds — used to convert lat/lng → % position on the SVG map.
const MAP_BOUNDS = {
  minLat: 24,  // southern Florida
  maxLat: 50,  // northern border
  minLng: -125, // west coast
  maxLng: -66,  // east coast
};

function latLngToPercent(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
  return {
    x: Math.max(2, Math.min(98, x)),
    y: Math.max(2, Math.min(98, y)),
  };
}

function Dot({ color = "#22d3ee" }: { color?: string }) {
  return (
    <span
      className="live-dot"
      style={{ background: color, boxShadow: `0 0 10px ${color}` }}
    />
  );
}

function hhmmss(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

function hhmmssFromIso(iso: string): string {
  return hhmmss(new Date(iso));
}

// Derive the fake "beacon stats" (battery/latency) deterministically per beacon.
function beaconStats(id: string) {
  const seed = id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const battery = 70 + (seed % 25);
  const latency = 110 + (seed % 90);
  return { battery: `${battery}%`, latency: `${latency}ms` };
}

export default function WitnessNodeDashboard() {
  const [incidents, setIncidents] = useState<FMIncident[]>([]);
  const [usingMock, setUsingMock] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FMSeverity | "ALL">("ALL");
  const [zoom, setZoom] = useState(1);
  const [paused, setPaused] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Poll live backend.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const { incidents: raw, usingMock } = await fetchIncidents();
      if (!alive) return;
      setIncidents(toFMIncidents(raw));
      setUsingMock(usingMock);
      setLoaded(true);
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Live clock (hydration-safe: starts null, set in effect).
  useEffect(() => {
    setClock(new Date());
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const selected: FMIncident | null = useMemo(() => {
    if (incidents.length === 0) return null;
    return (selectedId && incidents.find((i) => i.id === selectedId)) || incidents[0];
  }, [incidents, selectedId]);

  const visible = useMemo(
    () => incidents.filter((i) => filter === "ALL" || i.severity === filter),
    [incidents, filter],
  );

  // Beacon derived state: one marker per unique beacon (node_id).
  const beacons = useMemo(() => {
    const SEV_RANK: Record<FMSeverity, number> = { LOW: 0, MED: 1, HIGH: 2 };
    const byBeacon = new Map<string, FMIncident[]>();
    for (const inc of incidents) {
      if (!byBeacon.has(inc.beacon)) byBeacon.set(inc.beacon, []);
      byBeacon.get(inc.beacon)!.push(inc);
    }
    return Array.from(byBeacon.entries()).map(([beaconId, forBeacon]) => {
      const latest = forBeacon[0];
      // Parse coords "40.7891° N / 73.1350° W" back into numbers for map positioning.
      const match = latest.coordinates.match(/([\d.]+)°\s*([NS])\s*\/\s*([\d.]+)°\s*([EW])/);
      let x = 50, y = 50;
      if (match) {
        const lat = parseFloat(match[1]) * (match[2] === "N" ? 1 : -1);
        const lng = parseFloat(match[3]) * (match[4] === "E" ? 1 : -1);
        ({ x, y } = latLngToPercent(lat, lng));
      }
      const sev: FMSeverity = forBeacon.reduce<FMSeverity>(
        (worst, i) => (SEV_RANK[i.severity] > SEV_RANK[worst] ? i.severity : worst),
        "LOW",
      );
      const stats = beaconStats(beaconId);
      return {
        id: beaconId,
        place: `${latest.city.toUpperCase()}${latest.state ? ", " + latest.state : ""}`,
        x,
        y,
        severity: sev,
        battery: stats.battery,
        latency: stats.latency,
        incidentId: latest.id,
        incidentCount: forBeacon.length,
      };
    });
  }, [incidents]);

  // Telemetry log derived from most recent 3 incidents, newest first.
  const logs = useMemo(() => {
    const rows: Array<[string, string, string, string]> = [];
    for (const i of incidents.slice(0, 3)) {
      const t = hhmmssFromIso(new Date().toISOString());
      rows.push([t, i.beacon, "drop detected", `${i.coordinates} · ${i.city.toUpperCase()}, ${i.state}`]);
      rows.push([t, "RESCUE TRIAGE", `${i.severity} priority · ${i.survivors} survivor${i.survivors===1?"":"s"}`, `${i.hazards} HAZARDS · GEMINI VISION`]);
      if (i.transcript && i.transcript !== i.report) {
        rows.push([t, "VOICE RELAY", `heard: "${i.transcript.slice(0, 60)}"`, `LANG ${i.transcriptLanguage?.toUpperCase() || "AUTO"} · ELEVENLABS STT`]);
      }
      if (i.solanaTx) {
        rows.push([t, "INCIDENT RECORD", `on-chain · ${i.solanaTx.slice(0, 12)}…`, "SOLANA DEVNET · CONFIRMED"]);
      }
    }
    // Decorative heartbeat lines for context
    rows.push([clock ? hhmmss(clock) : "--:--:--", "NODE-BRAVO", "heartbeat OK · battery nominal", "MESH 18ms / NEXT AUDIT +06"]);
    return rows.slice(0, 6);
  }, [incidents, clock]);

  const nodeCount = beacons.length;
  const totalReports = incidents.length;
  const survivors = incidents.reduce((s, i) => s + i.survivors, 0);
  const critical = incidents.filter((i) => i.severity === "HIGH").length;

  const selectBeacon = (id: string | null) => id && setSelectedId(id);

  return (
    <main className="min-h-screen bg-black text-[#e8ecf3]">
      <div className="mx-auto max-w-[1600px] overflow-hidden">
        <header className="topbar">
          <div className="brand">
            <span className="brand-tab" />
            <img src="/assets/a90f4.svg" alt="Witness Node beacon" />
            <div>
              <strong>WITNESS·NODE</strong>
              <small>RESCUE NETWORK / {selected?.id ?? "STANDBY"}</small>
            </div>
          </div>
          <div className="network-state">
            <span className="pill cyan">
              <Dot color={usingMock ? "#ffd93d" : "#22d3ee"} /> {usingMock ? "MOCK DATA" : "LINK ESTABLISHED"}
            </span>
            <span className="pill lime">
              <Dot color="#1947d1" /> {String(nodeCount).padStart(2, "0")} BEACONS ACTIVE
            </span>
            <div className="clock">
              {clock ? clock.toLocaleTimeString("en-GB", { hour12: false }) : "--:--:--"} <i>UTC</i>
              <small>{usingMock ? "FALLBACK · BACKEND UNREACHABLE" : "LIVE / VULTR + TIGER + SOLANA"}</small>
            </div>
          </div>
          <div className="operator">
            <span className="slashes">/////</span>
            <span>
              OP. KATO<small>SHIFT 04 ↗</small>
            </span>
            <img src="/assets/c8c2e.png" alt="Operator Kato" />
          </div>
        </header>

        <div className="workspace">
          <section className="mission">
            <div>
              <span>01 / LIVE OPS</span>
              <h1>RESCUE COMMAND</h1>
              <em>US RESCUE NET</em>
            </div>
            <aside>
              NO SIGNAL LEFT BEHIND.
              <small>US RESPONSE NETWORK / SESSION {new Date().toISOString().slice(0, 10)}</small>
            </aside>
          </section>

          <section className="stats">
            {[
              ["TOTAL REPORTS", String(totalReports).padStart(2, "0"), totalReports > 0 ? "+1 NEW" : "STANDBY",  "live reports / backend"],
              ["ACTIVE BEACONS", String(nodeCount).padStart(2, "0"), "UPLINK OK", `${nodeCount} active / 0 silent`],
              ["SURVIVORS DETECTED", String(survivors).padStart(2, "0"), survivors > 0 ? "+1 VOICE" : "NONE", "AI-estimated / Gemini"],
              ["CRITICAL EVENTS", String(critical).padStart(2, "0"), critical > 0 ? "PRIORITY 01" : "NONE", "high-severity reports"],
            ].map((s, i) => (
              <article
                className={"stat " + (i === 1 ? "green" : "")}
                key={s[0]}
              >
                <div>
                  <b>{s[0]}</b>
                  <span>{i === 3 ? "⚠" : "++"}</span>
                </div>
                <motion.strong
                  key={s[1]}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {s[1]}
                </motion.strong>
                <div className="trend">
                  <i>{s[2]}</i>
                  <span>▁▂▂▅▅█</span>
                </div>
                <small>{s[3]}</small>
              </article>
            ))}
          </section>

          <section className="primary-grid">
            <article className="panel map-panel">
              <div className="panel-head">
                <div>
                  <label>DEPLOYMENT MAP</label>
                  <h2>
                    LIVE STATUS <small>CONUS / {String(nodeCount).padStart(2, "0")} ONLINE</small>
                  </h2>
                </div>
                <div className="filters">
                  <button
                    onClick={() => setFilter("ALL")}
                    className={filter === "ALL" ? "active" : ""}
                  >
                    ALL
                  </button>
                  {(["LOW", "MED", "HIGH"] as FMSeverity[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilter(s)}
                      className={filter === s ? "active" : ""}
                      style={{
                        color: severityColor[s],
                        borderColor: severityColor[s],
                      }}
                    >
                      <Dot color={severityColor[s]} />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="map-viewport">
                <RealMap
                  incidents={incidents}
                  onSelect={setSelectedId}
                  activeIncidentId={selected?.id ?? null}
                />
                <span className="scale">▲ ESRI DARK CANVAS · WGS84</span>
              </div>
              <div className="registry">
                <div className="registry-title">
                  <span>▲ ACTIVE BEACON REGISTRY</span>
                  <small>{beacons.length} ACTIVE / {incidents.length} TOTAL REPORTS</small>
                </div>
                <div className="registry-row header">
                  <span>BEACON ID</span>
                  <span>DEPLOYMENT ZONE</span>
                  <span>SEVERITY</span>
                  <span>POWER</span>
                  <span>LATENCY</span>
                  <span>LAST PING</span>
                </div>
                {beacons.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "#8a9bac", fontSize: 10 }}>
                    No beacons reporting. Drop one to begin.
                  </div>
                ) : (
                  beacons.map((b, i) => (
                    <button
                      className={
                        "registry-row " +
                        (selected?.beacon === b.id ? "chosen" : "")
                      }
                      key={b.id}
                      onClick={() => selectBeacon(b.incidentId)}
                    >
                      <span>
                        <Dot color={severityColor[b.severity]} />
                        {b.id}
                      </span>
                      <span>{b.place}</span>
                      <span style={{ color: severityColor[b.severity] }}>
                        {b.severity}
                      </span>
                      <span>{b.battery}</span>
                      <span>{b.latency}</span>
                      <span>{["18s", "92s", "06s"][i] ?? "—"} ago</span>
                    </button>
                  ))
                )}
              </div>
            </article>

            <AnimatePresence mode="wait">
              {selected ? (
                <motion.article
                  className="panel incident-detail"
                  key={selected.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <div className="incident-top">
                    <span>
                      <Dot color="#ff2d55" /> LATEST INCIDENT
                    </span>
                    <b>{selected.id} / {hhmmss(new Date())} UTC</b>
                  </div>
                  <div className="hero">
                    <img
                      src={selected.photo}
                      alt={`${selected.city} rescue incident`}
                    />
                    <div className="hero-fade" />
                    <span
                      className={`severity severity-${selected.severity.toLowerCase()}`}
                      style={{ background: severityColor[selected.severity] }}
                    >
                      <i aria-hidden="true" />● {selected.severity} SEVERITY
                    </span>
                    <button className="impact-trigger" type="button">
                      <span aria-hidden="true">ϟ</span> IMPACT TRIGGER
                    </button>
                    <div className="location">
                      <small>DEPLOYMENT ZONE / {selected.beacon}</small>
                      <h2>
                        {selected.city.toUpperCase()}{selected.state ? `, ${selected.state}` : ""}
                      </h2>
                      <p>
                        {selected.coordinates} · {selected.age}
                      </p>
                    </div>
                  </div>
                  <div className="detail-body">
                    {selected.transcript && (
                      <div className="voice">
                        <div className="voice-heading">
                          <span>
                            <img src="/assets/f1e4a.svg" alt="" /> MIC HEARD{selected.transcriptLanguage ? ` · ${selected.transcriptLanguage.toUpperCase()}` : ""}
                          </span>
                          <b>GEMINI + ELEVENLABS</b>
                        </div>
                        <blockquote>&ldquo;{selected.transcript}&rdquo;</blockquote>
                      </div>
                    )}
                    <label>
                      AI TRIAGE REPORT <small>GEMINI VISION</small>
                    </label>
                    <p className="report">{selected.report}</p>
                    <div className="counts">
                      <div>
                        <span>⚑</span>
                        <strong>{selected.survivors}</strong> SURVIVOR
                        {selected.survivors === 1 ? "" : "S"}
                      </div>
                      <div>
                        <span>△</span>
                        <strong>{selected.hazards}</strong> HAZARDS
                      </div>
                    </div>
                    {selected.hazardList.length > 0 && (
                      <div className="tags">
                        {selected.hazardList.slice(0, 6).map((h) => (
                          <span key={h}>{h.toUpperCase()}</span>
                        ))}
                      </div>
                    )}
                    <div className="audio">
                      <button
                        disabled={!selected.audio}
                        onClick={() => audioRef.current?.play()}
                        aria-label={
                          selected.audio ? "Play rescue instructions" : "Audio unavailable"
                        }
                      >
                        {selected.audio ? "▶" : "×"}
                      </button>
                      <div className="audio-copy">
                        <b>{selected.audio ? "PLAY RESCUE AUDIO" : "AUDIO UNAVAILABLE"}</b>
                        <small>{selected.audio ? "ELEVENLABS · 00:00 / 00:12" : "NO SOURCE"}</small>
                      </div>
                      <div className="waveform" aria-hidden="true">
                        {[8, 18, 12, 25, 17, 29, 14, 23, 11, 26, 18, 9].map((height, idx) => (
                          <i key={idx} style={{ height, animationDelay: `${idx * 70}ms` }} />
                        ))}
                      </div>
                      <time>{selected.audio ? "00:00 / 00:12" : "--:-- / --:--"}</time>
                      <audio ref={audioRef} src={selected.audio} />
                    </div>
                    {selected.solanaUrl ? (
                      <a href={selected.solanaUrl} target="_blank" rel="noopener noreferrer" className="chain">
                        <span>
                          <Dot /> LOGGED ON-CHAIN · SOLANA DEVNET
                        </span>
                        <b>↗</b>
                        <small>{selected.solanaTx}</small>
                      </a>
                    ) : (
                      <div className="chain">
                        <span>
                          <Dot /> AWAITING ON-CHAIN
                        </span>
                        <b>⋯</b>
                        <small>Solana transaction pending</small>
                      </div>
                    )}
                    <p className="guidance">
                      <b>VOICE GUIDANCE · {selected.transcriptLanguage?.toUpperCase() || "AUTO"}</b>&ldquo;{selected.transcript || "Help is on the way. Stay still if injured."}&rdquo;
                    </p>
                  </div>
                </motion.article>
              ) : (
                <article className="panel incident-detail">
                  <div className="incident-top">
                    <span><Dot color="#ff2d55" /> LATEST INCIDENT</span>
                    <b>— / {clock ? hhmmss(clock) : "--:--:--"} UTC</b>
                  </div>
                  <div style={{ padding: 60, textAlign: "center", color: "#8a9bac" }}>
                    {loaded ? "No incidents yet — drop a beacon." : "Connecting to field nodes…"}
                  </div>
                </article>
              )}
            </AnimatePresence>
          </section>

          <section className="buffer">
            <div className="section-title">
              <span>// 02</span>
              <h2>INCIDENT BUFFER</h2>
              <b>{String(visible.length).padStart(2, "0")}</b>
              <small>NEWEST FIRST</small>
              <i>HORIZONTAL FEED →</i>
            </div>
            <div className="filmstrip">
              {visible.length === 0 ? (
                <div style={{ padding: 20, color: "#8a9bac" }}>No incidents.</div>
              ) : (
                visible.map((item, index) => (
                  <motion.button
                    onClick={() => setSelectedId(item.id)}
                    className={"thumb " + (selected?.id === item.id ? "selected" : "")}
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
                  >
                    <div>
                      <img src={item.photo} alt="" />
                      <span
                        className="sev-dot"
                        style={{
                          background: severityColor[item.severity],
                          boxShadow: `0 0 8px ${severityColor[item.severity]}`,
                        }}
                      />
                      {index === 0 && <em>LIVE / SELECTED</em>}
                      <small>
                        {item.id} / {item.severity}
                      </small>
                    </div>
                    <strong>
                      {item.city.toUpperCase()}{item.state ? `, ${item.state}` : ""}
                    </strong>
                    <p>
                      {item.age}
                      <b>{item.code}</b>
                    </p>
                  </motion.button>
                ))
              )}
            </div>
            <div className="timeline">
              <span />
              <small>{String(visible.length).padStart(2, "0")} / {String(incidents.length).padStart(2, "0")} SIGNAL PACKETS</small>
            </div>
          </section>

          <section className={"panel telemetry " + (paused ? "paused" : "")}>
            <div className="console-head">
              <div>
                <Dot color="#a8e86c" />
                <b>TELEMETRY {paused ? "PAUSED" : "ACTIVE"}</b>
                <span>/ LIVE RESCUE NETWORK / OPERATIONS LOG</span>
              </div>
              <div>
                <b>WSS CONNECTED {usingMock ? "— MOCK" : "+ LIVE"}</b>
                <button onClick={() => setPaused((p) => !p)}>
                  {paused ? "RESUME" : "PAUSE"}
                </button>
                <span className="slashes yellow">/////</span>
              </div>
            </div>
            <div className="log-list">
              <AnimatePresence initial={false}>
                {logs.map((l, i) => (
                  <motion.div
                    className="log"
                    style={{ animationDelay: `${i * 0.18}s` }}
                    key={`log-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p>
                      <time>[{l[0]}]</time> <b>{l[1]}</b> <span>|</span> {l[2]}
                    </p>
                    <small>{l[3]}</small>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="prompt">
              <span>
                wn://live &gt; <i />
              </span>
              <small>
                <b>● GEMINI</b>
                <b>● ELEVENLABS</b>
                <b>● SOLANA</b>
                <b>● TIGER</b>
              </small>
              <em>WN-OS 2.4.0 / BUFFER-{String(incidents.length).padStart(2, "0")}</em>
            </div>
          </section>
          <footer>
            WITNESS-NODE / HUMANITY, ON RECORD.{" "}
            <span>WN-OS 2.4.0 ↔ {usingMock ? "MOCK BUFFER" : "LIVE BUFFER"}</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
