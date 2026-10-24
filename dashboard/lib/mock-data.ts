import type { IncidentSummary } from "./types";

export const MOCK_INCIDENTS: IncidentSummary[] = [
  {
    incident_id: "mock-001",
    node_id: "node-alpha",
    trigger: "drop",
    received_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    image_url: "https://images.unsplash.com/photo-1583318432730-a19c89692612?w=800",
    triage: {
      summary:
        "Partial structural collapse visible. Debris field in foreground; dust cloud settling. One possible survivor obscured behind beam.",
      severity: "high",
      survivors_detected: 1,
      hazards: ["unstable ceiling", "broken glass", "exposed rebar"],
      spoken_instructions:
        "Help is on the way. Stay still if you are injured. If you can hear this, tap three times on anything metal.",
    },
    audio_url: null,
    solana_tx: "SIM4a9c8b2e7d1f3a6b5c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
  },
  {
    incident_id: "mock-002",
    node_id: "node-bravo",
    trigger: "manual",
    received_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    image_url: "https://images.unsplash.com/photo-1575997205812-5c0cc3e4b1b1?w=800",
    triage: {
      summary:
        "Small fire visible on east wall. Smoke accumulating near ceiling. No survivors in frame.",
      severity: "critical",
      survivors_detected: 0,
      hazards: ["active fire", "heavy smoke", "possible gas leak"],
      spoken_instructions:
        "Fire detected. If you are nearby, stay low and move toward the open doorway on your left.",
    },
    audio_url: null,
    solana_tx: "SIMb3c2a1d4e5f6789012345678901234567890abcdef1234567890abcdef12345",
  },
  {
    incident_id: "mock-003",
    node_id: "node-charlie",
    trigger: "drop",
    received_at: new Date(Date.now() - 1000 * 60 * 23).toISOString(),
    image_url: "https://images.unsplash.com/photo-1612531386530-97286d97c2d2?w=800",
    triage: {
      summary:
        "Room appears stable. No visible hazards or survivors. Daylight present through window.",
      severity: "low",
      survivors_detected: 0,
      hazards: [],
      spoken_instructions:
        "This area appears clear. If you hear this and need help, press the red button on the device.",
    },
    audio_url: null,
    solana_tx: "SIMc9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d",
  },
];
