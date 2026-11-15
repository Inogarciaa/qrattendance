import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * OpenStreetMap picker used when an admin chooses where an event happens.
 *
 * The map is optional decoration on top of plain coordinates: the event still
 * stores latitude/longitude, so the fence works even if the tiles never load.
 * Click anywhere to place the pin, drag the pin to fine-tune, and the circle
 * shows the radius students must be inside to check themselves in.
 */

// Liceo de Cagayan University main campus — a sane start for this deployment.
const DEFAULT_CENTER = { latitude: 8.4857, longitude: 124.6393 };
const DEFAULT_ZOOM = 16;

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function pinIcon() {
  return L.divIcon({
    className: "lq-pin",
    html: '<span class="lq-pin-dot"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function round6(value) {
  return Number(Number(value).toFixed(6));
}

export default function LocationPicker({
  latitude = null,
  longitude = null,
  radius = 100,
  disabled = false,
  onChange,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);

  onChangeRef.current = onChange;
  disabledRef.current = disabled;

  const hasPin =
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude));

  // Create the map once. Everything after this only moves the marker.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || mapRef.current) return undefined;

    const start = hasPin
      ? [Number(latitude), Number(longitude)]
      : [DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude];

    const map = L.map(node, {
      center: start,
      zoom: hasPin ? DEFAULT_ZOOM : 15,
      scrollWheelZoom: false,
    });

    L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: ATTRIBUTION,
    }).addTo(map);

    map.on("click", (event) => {
      if (disabledRef.current) return;
      onChangeRef.current?.({
        latitude: round6(event.latlng.lat),
        longitude: round6(event.latlng.lng),
      });
    });

    mapRef.current = map;

    // The card is laid out after mount; without this the tiles render grey.
    const timer = setTimeout(() => map.invalidateSize(), 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // Only on mount: later prop changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the marker and radius circle in sync with the form.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hasPin) {
      markerRef.current?.remove();
      markerRef.current = null;
      circleRef.current?.remove();
      circleRef.current = null;
      map.panTo([DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude], { animate: false });
      return;
    }

    const position = [Number(latitude), Number(longitude)];
    const safeRadius = Number.isFinite(Number(radius)) && Number(radius) > 0 ? Number(radius) : 100;

    if (markerRef.current) {
      markerRef.current.setLatLng(position);
      markerRef.current.setIcon(pinIcon());
    } else {
      const marker = L.marker(position, {
        draggable: !disabled,
        icon: pinIcon(),
        keyboard: false,
        title: "Event venue",
      }).addTo(map);

      marker.on("dragend", () => {
        const point = marker.getLatLng();
        onChangeRef.current?.({
          latitude: round6(point.lat),
          longitude: round6(point.lng),
        });
      });

      markerRef.current = marker;
    }

    if (circleRef.current) {
      circleRef.current.setLatLng(position);
      circleRef.current.setRadius(safeRadius);
    } else {
      circleRef.current = L.circle(position, {
        radius: safeRadius,
        color: "#2563eb",
        weight: 1.5,
        fillColor: "#2563eb",
        fillOpacity: 0.08,
      }).addTo(map);
    }

    map.panTo(position, { animate: false });
  }, [hasPin, latitude, longitude, radius, disabled]);

  return (
    <div className="map-field">
      <div className="map-canvas" ref={containerRef} role="application" aria-label="Event venue map" />
      {!hasPin && (
        <div className="map-overlay">Click the map to place the venue pin.</div>
      )}
      {hasPin && (
        <div className="map-readout">
          {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)} · {radius} m radius
        </div>
      )}
    </div>
  );
}
