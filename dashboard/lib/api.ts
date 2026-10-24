import type { IncidentSummary } from "./types";
import { MOCK_INCIDENTS } from "./mock-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchIncidents(): Promise<{
  incidents: IncidentSummary[];
  usingMock: boolean;
}> {
  try {
    const r = await fetch(`${API_URL}/incidents`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const incidents = (await r.json()) as IncidentSummary[];
    return { incidents: incidents.map(absolutize), usingMock: false };
  } catch {
    return { incidents: MOCK_INCIDENTS, usingMock: true };
  }
}

// Backend returns image_url and audio_url as path-only (e.g. /media/images/x.jpg).
// Prepend API_URL so <img src> works from the dashboard origin.
function absolutize(i: IncidentSummary): IncidentSummary {
  return {
    ...i,
    image_url: i.image_url.startsWith("http") ? i.image_url : `${API_URL}${i.image_url}`,
    audio_url:
      i.audio_url && !i.audio_url.startsWith("http") ? `${API_URL}${i.audio_url}` : i.audio_url,
  };
}

export function solanaExplorerUrl(tx: string): string {
  return `https://explorer.solana.com/tx/${tx}?cluster=devnet`;
}
