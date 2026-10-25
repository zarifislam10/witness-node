"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

import { IDLE_NODES, NODE_LOCATIONS, locationFor } from "@/lib/nodes";
import type { IncidentSummary, Severity } from "@/lib/types";

const SEVERITY_COLOR: Record<Severity, string> = {
  low:      "#4ade80",
  medium:   "#fbbf24",
  high:     "#ff5555",
  critical: "#ef4444",
};
const IDLE_COLOR = "#64748b";

interface ActiveMarker {
  nodeId: string;
  location: { name: string; city: string; coords: [number, number] };
  severity: Severity;
  incidentCount: number;
}

function deriveActiveMarkers(incidents: IncidentSummary[]): ActiveMarker[] {
  // Group by effective location (prefer incident.lat/lng, then incident.location, then node_id).
  const groups = new Map<string, { nodeId: string; coords: [number, number]; city: string; name: string; incidents: IncidentSummary[] }>();

  for (const i of incidents) {
    const hardcoded = locationFor(i.node_id);
    const coords: [number, number] = i.lat != null && i.lng != null
      ? [i.lat, i.lng]
      : hardcoded.coords;
    const city = i.location || hardcoded.city;
    const key = `${coords[0].toFixed(2)},${coords[1].toFixed(2)}`;

    if (!groups.has(key)) {
      groups.set(key, { nodeId: i.node_id, coords, city, name: hardcoded.name, incidents: [] });
    }
    groups.get(key)!.incidents.push(i);
  }

  const SEV_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  return Array.from(groups.values()).map((g) => {
    const severity: Severity = g.incidents.reduce<Severity>((worst, i) =>
      SEV_RANK[i.triage.severity] > SEV_RANK[worst] ? i.triage.severity : worst, "low");
    return {
      nodeId: g.nodeId,
      location: { name: g.name, city: g.city, coords: g.coords },
      severity,
      incidentCount: g.incidents.length,
    };
  });
}

export default function DeploymentMap({ incidents }: { incidents: IncidentSummary[] }) {
  const active = deriveActiveMarkers(incidents);
  const activeCoords = new Set(active.map((a) => a.location.coords.join(",")));

  // Always-render idle "deployed" nodes to make the map feel populated.
  const idleAll: Array<{ name: string; city: string; coords: [number, number] }> = [
    ...Object.values(NODE_LOCATIONS).filter(
      (v, i, arr) => arr.findIndex(x => x.coords[0] === v.coords[0] && x.coords[1] === v.coords[1]) === i,
    ),
    ...IDLE_NODES,
  ].filter(n => !activeCoords.has(n.coords.join(",")));

  return (
    <MapContainer
      center={[39.5, -98.5]}
      zoom={4}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%", background: "#070a12" }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
      <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" />

      {idleAll.map((n) => (
        <CircleMarker
          key={`idle-${n.coords.join(",")}`}
          center={n.coords}
          radius={4}
          pathOptions={{
            color: IDLE_COLOR,
            fillColor: IDLE_COLOR,
            fillOpacity: 0.3,
            weight: 1,
            className: "idle-marker",
          }}
        >
          <Tooltip direction="top" offset={[0, -4]}>
            <strong>Node {n.name}</strong> · {n.city}
            <br />
            <span style={{ opacity: 0.7 }}>idle · awaiting trigger</span>
          </Tooltip>
        </CircleMarker>
      ))}

      {active.map((m) => {
        const color = SEVERITY_COLOR[m.severity];
        return (
          <div key={m.nodeId}>
            {/* Expanding ping ring */}
            <CircleMarker
              center={m.location.coords}
              radius={22}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0,
                weight: 2,
                className: "ping-ring",
              }}
            />
            {/* Soft outer halo */}
            <CircleMarker
              center={m.location.coords}
              radius={14}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.18,
                weight: 0,
              }}
            />
            {/* Solid core */}
            <CircleMarker
              center={m.location.coords}
              radius={6}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 1,
                weight: 2,
                className: "core-marker",
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <strong>Node {m.location.name}</strong> · {m.location.city}
                <br />
                <span style={{ color }}>● {m.severity}</span> · {m.incidentCount} report{m.incidentCount === 1 ? "" : "s"}
              </Tooltip>
            </CircleMarker>
          </div>
        );
      })}
    </MapContainer>
  );
}
