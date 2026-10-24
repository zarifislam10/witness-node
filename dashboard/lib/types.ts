// Mirror of backend/app/models.py::IncidentSummary.
// Keep in sync when the backend contract changes.

export type Severity = "low" | "medium" | "high" | "critical";

export interface TriageReport {
  summary: string;
  severity: Severity;
  survivors_detected: number;
  hazards: string[];
  spoken_instructions: string;
}

export interface IncidentSummary {
  incident_id: string;
  node_id: string;
  trigger: "drop" | "manual" | "test";
  received_at: string; // ISO-8601
  image_url: string;
  triage: TriageReport;
  audio_url: string | null;
  solana_tx: string | null;
}
