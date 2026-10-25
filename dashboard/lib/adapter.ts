// Maps our backend IncidentSummary → the Figma Make dashboard's Incident shape.

import { solanaExplorerUrl } from "./api";
import { locationFor } from "./nodes";
import type { IncidentSummary, Severity as BackendSeverity } from "./types";

export type FMSeverity = "LOW" | "MED" | "HIGH";

export interface FMIncident {
  id: string;
  city: string;
  state: string;
  severity: FMSeverity;
  survivors: number;
  hazards: number;
  age: string;
  code: string;
  photo: string;
  beacon: string;
  coordinates: string;
  transcript: string;
  report: string;
  audio?: string;
  solanaTx?: string | null;
  solanaUrl?: string | null;
  hazardList: string[];
  transcriptLanguage?: string | null;
}

const SEVERITY_MAP: Record<BackendSeverity, FMSeverity> = {
  low:      "LOW",
  medium:   "MED",
  high:     "HIGH",
  critical: "HIGH",
};

function ageOf(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${String(Math.floor(diff / 3600)).padStart(2, "0")}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function splitCityState(cityStr: string | null | undefined, nodeId: string): { city: string; state: string } {
  if (cityStr) {
    const parts = cityStr.split(",").map((s) => s.trim());
    if (parts.length >= 2) return { city: parts[0], state: parts[1] };
    return { city: parts[0], state: "" };
  }
  const loc = locationFor(nodeId);
  const parts = loc.city.split(",").map((s) => s.trim());
  return { city: parts[0] || "Unknown", state: parts[1] || "" };
}

function coordsOf(incident: IncidentSummary): string {
  if (incident.lat != null && incident.lng != null) {
    const latH = incident.lat >= 0 ? "N" : "S";
    const lngH = incident.lng >= 0 ? "E" : "W";
    return `${Math.abs(incident.lat).toFixed(4)}° ${latH} / ${Math.abs(incident.lng).toFixed(4)}° ${lngH}`;
  }
  const loc = locationFor(incident.node_id);
  const [lat, lng] = loc.coords;
  const latH = lat >= 0 ? "N" : "S";
  const lngH = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latH} / ${Math.abs(lng).toFixed(4)}° ${lngH}`;
}

function beaconOf(nodeId: string): string {
  const nodeName = locationFor(nodeId).name.toUpperCase();
  return `NODE-${nodeName}`;
}

function shortId(incidentId: string): string {
  // Needs to be unique across incidents. We use 8 chars (plenty of entropy for a demo).
  // "991eaf4d-55cc-4e94-ad05-bd937c6366bc" → "WN-991EAF4D"
  // "mock-001" → "WN-MOCK001"
  const hex = incidentId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `WN-${hex}`;
}

export function toFMIncident(i: IncidentSummary): FMIncident {
  const { city, state } = splitCityState(i.location, i.node_id);
  const sev = SEVERITY_MAP[i.triage.severity] ?? "LOW";
  return {
    id: shortId(i.incident_id),
    city,
    state,
    severity: sev,
    survivors: i.triage.survivors_detected,
    hazards: i.triage.hazards.length,
    age: ageOf(i.received_at),
    code: `${i.triage.survivors_detected} SV / ${i.triage.hazards.length} HZ`,
    photo: i.image_url,
    beacon: beaconOf(i.node_id),
    coordinates: coordsOf(i),
    transcript: i.transcript ?? i.triage.spoken_instructions,
    report: i.triage.summary,
    audio: i.audio_url ?? undefined,
    solanaTx: i.solana_tx,
    solanaUrl: i.solana_tx ? solanaExplorerUrl(i.solana_tx) : null,
    hazardList: i.triage.hazards,
    transcriptLanguage: i.transcript_language,
  };
}

export function toFMIncidents(incidents: IncidentSummary[]): FMIncident[] {
  return incidents.map(toFMIncident);
}
