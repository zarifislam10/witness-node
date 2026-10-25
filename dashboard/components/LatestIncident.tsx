"use client";

import { motion } from "framer-motion";

import { solanaExplorerUrl } from "@/lib/api";
import { locationFor } from "@/lib/nodes";
import type { IncidentSummary } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function triggerLabel(trigger: string): string {
  switch (trigger) {
    case "drop": return "Impact";
    case "manual": return "Manual";
    case "test": return "Test";
    default: return trigger;
  }
}

export function LatestIncident({ incident }: { incident: IncidentSummary | null }) {
  if (!incident) {
    return (
      <section className="hero empty">
        <div>
          <div className="eyebrow">Latest incident</div>
          <div className="hero-empty-title">Awaiting first report</div>
          <div className="hero-empty-sub">Drop a node to begin</div>
        </div>
      </section>
    );
  }

  const { triage } = incident;
  const hardcoded = locationFor(incident.node_id);
  const displayCity = incident.location || hardcoded.city;

  return (
    <motion.section
      key={incident.incident_id}
      className="hero"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="hero-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={incident.image_url} alt="latest incident" />
        <div className="hero-img-gradient" />
        <div className="hero-badges">
          <span className={`sev-badge sev-${triage.severity}`}>
            <span className="sev-dot" /> {triage.severity} severity
          </span>
          <span className="pill-badge">
            {triggerLabel(incident.trigger)} · {timeAgo(incident.received_at)}
          </span>
        </div>
        <div className="hero-location-overlay">
          <div className="hero-location-label">Deployment zone</div>
          <div className="hero-location-city">{displayCity}</div>
        </div>
      </div>

      <div className="hero-body">
        {incident.transcript && (
          <motion.div
            className="transcript-card"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="transcript-head">
              <span className="transcript-icon">🎙</span>
              <span className="eyebrow">
                Mic heard
                {incident.transcript_language && ` · ${incident.transcript_language.toUpperCase()}`}
              </span>
            </div>
            <blockquote className="transcript-text">&ldquo;{incident.transcript}&rdquo;</blockquote>
          </motion.div>
        )}

        <div className="eyebrow">AI triage report</div>
        <p className="hero-summary">{triage.summary}</p>

        <div className="hero-metrics">
          <div className="metric">
            <div className="metric-value">{triage.survivors_detected}</div>
            <div className="metric-label">
              {triage.survivors_detected === 1 ? "survivor" : "survivors"} detected
            </div>
          </div>
          <div className="metric">
            <div className="metric-value">{triage.hazards.length}</div>
            <div className="metric-label">
              {triage.hazards.length === 1 ? "hazard" : "hazards"} identified
            </div>
          </div>
        </div>

        {triage.hazards.length > 0 && (
          <div className="hazards">
            {triage.hazards.map((h) => (
              <span key={h} className="hazard-tag">{h}</span>
            ))}
          </div>
        )}

        <div className="hero-footer">
          {incident.audio_url && (
            <div className="audio-wrap">
              <div className="audio-label">Spoken instructions</div>
              <audio controls src={incident.audio_url} preload="none" />
            </div>
          )}

          {incident.solana_tx && (
            <a
              className="chain-link"
              href={solanaExplorerUrl(incident.solana_tx)}
              target="_blank"
              rel="noopener noreferrer"
              title={incident.solana_tx}
            >
              <span className="chain-dot" />
              <span>
                <span className="chain-label">Logged on-chain</span>
                <code className="chain-hash">
                  {incident.solana_tx.slice(0, 10)}…{incident.solana_tx.slice(-6)}
                </code>
              </span>
            </a>
          )}
        </div>
      </div>
    </motion.section>
  );
}
