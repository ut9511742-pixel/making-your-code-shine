import { Fragment, useEffect } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import type { BloodRequest } from "@/lib/bloodconnect";

const requestIcon = L.divIcon({
  className: "",
  html: '<span class="tracking-marker"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapBounds({ items }: { items: BloodRequest[] }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([]);
    for (const item of items) {
      if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue;
      const latOffset = item.radius_km / 111;
      const lonOffset = item.radius_km / (111 * Math.max(Math.cos((item.latitude * Math.PI) / 180), 0.01));
      bounds.extend([item.latitude - latOffset, item.longitude - lonOffset]);
      bounds.extend([item.latitude + latOffset, item.longitude + lonOffset]);
    }
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
    requestAnimationFrame(() => map.invalidateSize());
  }, [items, map]);

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export function RequestTrackingMap({ items }: { items: BloodRequest[] }) {
  const locations = items.filter((item) =>
    Number.isFinite(item.latitude) && item.latitude >= -90 && item.latitude <= 90 &&
    Number.isFinite(item.longitude) && item.longitude >= -180 && item.longitude <= 180,
  );

  return (
    <section className="overflow-hidden rounded-md border border-line bg-card shadow-sm" aria-label="Request location map">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="font-mono text-xs uppercase text-brand">Live coverage</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">Request map</h2>
        </div>
        <p className="text-sm text-ink-soft">{locations.length} request location{locations.length === 1 ? "" : "s"}</p>
      </div>
      {locations.length === 0 ? (
        <div className="grid min-h-64 place-items-center px-6 py-12 text-center">
          <div>
            <p className="font-display text-2xl text-ink">No locations to show yet</p>
            <p className="mt-2 max-w-sm text-sm text-ink-soft">Requests with a saved location will appear here with their donor notification area.</p>
          </div>
        </div>
      ) : (
        <div className="request-tracking-map h-[320px] sm:h-[400px]">
          <MapContainer center={[locations[0]?.latitude ?? 22.7196, locations[0]?.longitude ?? 75.8577]} zoom={11} scrollWheelZoom className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBounds items={locations} />
            {locations.map((item) => {
              const position: [number, number] = [item.latitude, item.longitude];
              return (
                <Fragment key={item.id}>
                  <Circle center={position} radius={item.radius_km * 1000} pathOptions={{ color: "var(--color-brand)", fillColor: "var(--color-brand)", fillOpacity: 0.1, weight: 2 }} />
                  <Marker position={position} icon={requestIcon}>
                    <Popup>
                      <strong>{item.hospital}</strong><br />
                      {item.blood_group} · {item.units} unit{item.units === 1 ? "" : "s"}<br />
                      {item.city} · {item.radius_km} km coverage<br />
                      <span className="capitalize">{item.status}</span>
                    </Popup>
                  </Marker>
                </Fragment>
              );
            })}
          </MapContainer>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-brand" /> Blood request</span>
        <span>Circles show the donor notification radius</span>
      </div>
    </section>
  );
}