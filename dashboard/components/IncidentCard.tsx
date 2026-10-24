import type { IncidentSummary } from "@/lib/types";
import { solanaExplorerUrl } from "@/lib/api";

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function IncidentCard({ incident }: { incident: IncidentSummary }) {
  const { triage } = incident;
  return (
    <article className="card">
      <div className="img-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={incident.image_url} alt={`Incident ${incident.incident_id}`} />
      </div>

      <div className="body">
        <div className="top-row">
          <div className="node">
            <strong>{incident.node_id}</strong>
            <span>· {incident.trigger} trigger · {timeAgo(incident.received_at)}</span>
          </div>
          <span className={`sev ${triage.severity}`}>{triage.severity}</span>
        </div>

        <p className="summary">{triage.summary}</p>

        <div className="survivors">
          <span className="count">{triage.survivors_detected}</span>
          <span>survivor{triage.survivors_detected === 1 ? "" : "s"} detected</span>
        </div>

        {triage.hazards.length > 0 && (
          <div className="hazards">
            {triage.hazards.map((h) => (
              <span key={h} className="hazard-tag">⚠ {h}</span>
            ))}
          </div>
        )}

        <div className="footer">
          {incident.audio_url ? (
            <audio controls src={incident.audio_url} preload="none" />
          ) : (
            <span>— no audio —</span>
          )}

          {incident.solana_tx ? (
            <a
              className="tx-link"
              href={solanaExplorerUrl(incident.solana_tx)}
              target="_blank"
              rel="noopener noreferrer"
              title={incident.solana_tx}
            >
              ⛓ solana: <code>{incident.solana_tx.slice(0, 10)}…{incident.solana_tx.slice(-6)}</code>
            </a>
          ) : (
            <span>— not logged —</span>
          )}
        </div>
      </div>
    </article>
  );
}
