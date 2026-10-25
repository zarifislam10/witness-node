"use client";

import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useId, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";

function MarkerFlyController({
  markers,
  activeIncidentId,
}: {
  markers: { lat: number; lng: number; incidentId: string }[];
  activeIncidentId: string | null;
}) {
  const map = useMap();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!activeIncidentId || activeIncidentId === last.current) return;
    const target = markers.find((m) => m.incidentId === activeIncidentId);
    if (!target) return;
    last.current = activeIncidentId;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 6), {
      duration: 0.9,
      easeLinearity: 0.25,
    });
  }, [activeIncidentId, markers, map]);

  return null;
}

function MapControls() {
  const map = useMap();
  const step = 120;
  const pan = (dx: number, dy: number) => map.panBy([dx, dy], { animate: true });
  return (
    <>
      <div className="map-zoom-tl">
        <button type="button" onClick={() => map.zoomIn()} aria-label="zoom in">+</button>
        <button type="button" onClick={() => map.zoomOut()} aria-label="zoom out">−</button>
      </div>
      <div className="map-controls">
        <div className="mc-pad">
          <button className="mc-up" type="button" onClick={() => pan(0, -step)} aria-label="pan up">↑</button>
          <button className="mc-left" type="button" onClick={() => pan(-step, 0)} aria-label="pan left">←</button>
          <button className="mc-right" type="button" onClick={() => pan(step, 0)} aria-label="pan right">→</button>
          <button className="mc-down" type="button" onClick={() => pan(0, step)} aria-label="pan down">↓</button>
        </div>
      </div>
    </>
  );
}

import type { FMIncident, FMSeverity } from "@/lib/adapter";

const SEVERITY_COLOR: Record<FMSeverity, string> = {
  LOW: "#22d3ee",
  MED: "#ffd93d",
  HIGH: "#ff2d55",
};

interface Marker {
  key: string;
  lat: number;
  lng: number;
  severity: FMSeverity;
  city: string;
  state: string;
  beacon: string;
  count: number;
  incidentId: string;
}

function parseCoords(coords: string): { lat: number; lng: number } | null {
  const m = coords.match(/([\d.]+)°\s*([NS])\s*\/\s*([\d.]+)°\s*([EW])/);
  if (!m) return null;
  return {
    lat: parseFloat(m[1]) * (m[2] === "N" ? 1 : -1),
    lng: parseFloat(m[3]) * (m[4] === "E" ? 1 : -1),
  };
}

function deriveMarkers(incidents: FMIncident[]): Marker[] {
  const SEV_RANK: Record<FMSeverity, number> = { LOW: 0, MED: 1, HIGH: 2 };
  const groups = new Map<string, Marker>();
  for (const i of incidents) {
    const parsed = parseCoords(i.coordinates);
    if (!parsed) continue;
    const key = `${parsed.lat.toFixed(3)},${parsed.lng.toFixed(3)}`;
    const existing = groups.get(key);
    if (existing) {
      if (SEV_RANK[i.severity] > SEV_RANK[existing.severity]) {
        existing.severity = i.severity;
      }
      existing.count += 1;
    } else {
      groups.set(key, {
        key,
        lat: parsed.lat,
        lng: parsed.lng,
        severity: i.severity,
        city: i.city,
        state: i.state,
        beacon: i.beacon,
        count: 1,
        incidentId: i.id,
      });
    }
  }
  return Array.from(groups.values());
}

export default function RealMap({
  incidents,
  onSelect,
  activeIncidentId,
}: {
  incidents: FMIncident[];
  onSelect?: (incidentId: string) => void;
  activeIncidentId?: string | null;
}) {
  const mapKey = useId();
  const markers = deriveMarkers(incidents);

  return (
    <MapContainer
      key={mapKey}
      center={[39.5, -98.5]}
      zoom={4}
      minZoom={3}
      maxZoom={11}
      scrollWheelZoom
      zoomControl={false}
      dragging
      touchZoom
      doubleClickZoom
      boxZoom
      keyboard
      attributionControl={false}
      style={{ height: "100%", width: "100%", background: "#040810", cursor: "grab" }}
    >
      <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}" />
      <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}" />

      <MapControls />

      <MarkerFlyController markers={markers} activeIncidentId={activeIncidentId ?? null} />

      {markers.map((m) => {
        const color = SEVERITY_COLOR[m.severity];
        const active = m.incidentId === activeIncidentId;
        const handleClick = () => onSelect?.(m.incidentId);
        return (
          <Fragment key={m.key}>
            {/* Selection ring — only on active marker, bright + animated */}
            {active && (
              <>
                <CircleMarker
                  center={[m.lat, m.lng]}
                  radius={28}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0,
                    weight: 2,
                    opacity: 0.9,
                    className: "selection-ring",
                  }}
                />
                <CircleMarker
                  center={[m.lat, m.lng]}
                  radius={34}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0,
                    weight: 1,
                    opacity: 0.5,
                    dashArray: "4 4",
                    className: "selection-ring-outer",
                  }}
                />
              </>
            )}

            {/* Expanding ping ring */}
            <CircleMarker
              center={[m.lat, m.lng]}
              radius={20}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0,
                weight: 2,
                className: "ping-ring",
              }}
            />
            {/* Soft halo */}
            <CircleMarker
              center={[m.lat, m.lng]}
              radius={14}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.2,
                weight: 0,
              }}
            />
            {/* Solid core */}
            <CircleMarker
              center={[m.lat, m.lng]}
              radius={active ? 8 : 6}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 1,
                weight: 2,
                className: "core-marker",
              }}
              eventHandlers={{ click: handleClick }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <strong style={{ color }}>{m.beacon}</strong>
                <br />
                {m.city.toUpperCase()}{m.state ? `, ${m.state}` : ""}
                <br />
                <span style={{ opacity: 0.7 }}>
                  {m.count} report{m.count === 1 ? "" : "s"} · {m.severity}
                </span>
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
