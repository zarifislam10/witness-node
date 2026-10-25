// Hardcoded deployment locations per node ID.
// In production the Pi would self-report GPS at boot; for the demo we assign.

export interface NodeLocation {
  name: string;
  city: string;
  coords: [number, number]; // [lat, lng]
}

export const NODE_LOCATIONS: Record<string, NodeLocation> = {
  "node-001":     { name: "Alpha",   city: "Atlanta, GA",       coords: [33.7490, -84.3880] },
  "node-002":     { name: "Bravo",   city: "New York, NY",      coords: [40.7128, -74.0060] },
  "node-003":     { name: "Charlie", city: "San Francisco, CA", coords: [37.7749, -122.4194] },
  "node-alpha":   { name: "Alpha",   city: "Atlanta, GA",       coords: [33.7490, -84.3880] },
  "node-bravo":   { name: "Bravo",   city: "New York, NY",      coords: [40.7128, -74.0060] },
  "node-charlie": { name: "Charlie", city: "San Francisco, CA", coords: [37.7749, -122.4194] },
};

// Decorative "deployed but idle" markers so the map doesn't look sparse.
export const IDLE_NODES: NodeLocation[] = [
  { name: "Delta",   city: "Chicago, IL",      coords: [41.8781, -87.6298] },
  { name: "Echo",    city: "Houston, TX",      coords: [29.7604, -95.3698] },
  { name: "Foxtrot", city: "Seattle, WA",      coords: [47.6062, -122.3321] },
  { name: "Golf",    city: "Miami, FL",        coords: [25.7617, -80.1918] },
  { name: "Hotel",   city: "Denver, CO",       coords: [39.7392, -104.9903] },
  { name: "India",   city: "Boston, MA",       coords: [42.3601, -71.0589] },
];

export const DEFAULT_LOCATION: NodeLocation = NODE_LOCATIONS["node-001"];

export function locationFor(nodeId: string): NodeLocation {
  return NODE_LOCATIONS[nodeId] ?? {
    name: nodeId,
    city: "Unknown",
    coords: DEFAULT_LOCATION.coords,
  };
}
