/**
 * DriverGPSTracker.jsx
 *
 * Features:
 *  • Uses browser Geolocation watchPosition
 *  • Pushes coords to PATCH /api/rides/:id/location
 *  • Uses Leaflet + OpenStreetMap + OSRM for routing
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import './DriverGPSTracker.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PUSH_INTERVAL_MS = 5000;
const PICKUP_RADIUS_M  = 200;
const DROPOFF_RADIUS_M = 300;

/** Haversine distance between two {lat,lng} points, in metres */
function haversineM(a, b) {
    if (!a || !b) return Infinity;
    const R  = 6371000;
    const φ1 = (a.lat * Math.PI) / 180;
    const φ2 = (b.lat * Math.PI) / 180;
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
    const s  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Geocode address via OpenStreetMap Nominatim */
async function geocodeAddress(address) {
    try {
        const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
        const res  = await fetch(url, { headers: { 'User-Agent': 'ssg-logistics-driver' } });
        const data = await res.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
    } catch (_) {}
    return null;
}

/** Fetch route geometry from OSRM */
async function fetchRoute(origin, destination) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        const res  = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes?.[0]) {
            return data.routes[0].geometry;
        }
    } catch (_) {}
    return null;
}

/** Format metres into "X km" or "X m" */
function fmtDist(m) {
    if (m === Infinity) return '—';
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export default function DriverGPSTracker({ ride, onGeofenceBlock }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const routeLayer = useRef(null);

    const pickupMarker = useRef(null);
    const dropoffMarker = useRef(null);
    const driverMarker = useRef(null);

    const [pos, setPos]             = useState(null);
    const [gpsError, setGpsError]   = useState('');
    const [pushStatus, setPushStatus] = useState('');
    const [pickupCoord, setPickupCoord]   = useState(null);
    const [dropoffCoord, setDropoffCoord] = useState(null);
    const [geocoding, setGeocoding]       = useState(true);

    const lastPushedAt = useRef(0);
    const watchId      = useRef(null);

    // Geocode addresses once
    useEffect(() => {
        if (!ride) { setGeocoding(false); return; }
        setGeocoding(true);
        Promise.all([
            geocodeAddress(ride.pickupLocation),
            geocodeAddress(ride.dropoffLocation),
        ]).then(([pu, dr]) => {
            setPickupCoord(pu);
            setDropoffCoord(dr);
            setGeocoding(false);
        });
    }, [ride?._id, ride?.pickupLocation, ride?.dropoffLocation]);

    // Push position to backend
    const pushLocation = useCallback(
        async (location) => {
            if (!ride) return;
            try {
                const res = await fetch(`${API}/api/rides/${ride._id}/location`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(location),
                });
                setPushStatus(res.ok ? 'ok' : 'error');
            } catch {
                setPushStatus('error');
            }
        },
        [ride?._id]
    );

    // Start watching GPS
    useEffect(() => {
        if (!ride) return;
        if (!navigator.geolocation) {
            setGpsError('Geolocation is not supported by your browser.');
            return;
        }

        watchId.current = navigator.geolocation.watchPosition(
            (position) => {
                setGpsError('');
                const location = {
                    lat:      position.coords.latitude,
                    lng:      position.coords.longitude,
                    heading:  position.coords.heading,
                    speed:    position.coords.speed,
                    accuracy: position.coords.accuracy,
                };
                setPos(location);

                const now = Date.now();
                if (now - lastPushedAt.current >= PUSH_INTERVAL_MS) {
                    lastPushedAt.current = now;
                    pushLocation(location);
                }
            },
            (err) => setGpsError(`GPS error: ${err.message}`),
            { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
        );

        return () => {
            if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
        };
    }, [ride?._id, pushLocation]);

    // Initialize Leaflet map
    useEffect(() => {
        if (!window.L || !mapRef.current || mapInstance.current) return;

        mapInstance.current = window.L.map(mapRef.current, {
            zoomControl: true,
            attributionControl: false
        }).setView([18.4088, 76.5603], 12);

        window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
        }).addTo(mapInstance.current);
    }, []);

    // Update map markers
    useEffect(() => {
        if (!window.L || !mapInstance.current) return;
        const L = window.L;

        const bounds = [];

        // 1. Pickup Marker
        if (pickupCoord) {
            if (!pickupMarker.current) {
                const el = L.divIcon({
                    html: `<div style="font-size: 24px; transform: translate(-30%, -30%);">🟢</div>`,
                    className: 'leaflet-emoji-icon',
                    iconSize: [24, 24]
                });
                pickupMarker.current = L.marker([pickupCoord.lat, pickupCoord.lng], { icon: el }).addTo(mapInstance.current);
            } else {
                pickupMarker.current.setLatLng([pickupCoord.lat, pickupCoord.lng]);
            }
            bounds.push([pickupCoord.lat, pickupCoord.lng]);
        }

        // 2. Dropoff Marker
        if (dropoffCoord) {
            if (!dropoffMarker.current) {
                const el = L.divIcon({
                    html: `<div style="font-size: 24px; transform: translate(-30%, -30%);">🔴</div>`,
                    className: 'leaflet-emoji-icon',
                    iconSize: [24, 24]
                });
                dropoffMarker.current = L.marker([dropoffCoord.lat, dropoffCoord.lng], { icon: el }).addTo(mapInstance.current);
            } else {
                dropoffMarker.current.setLatLng([dropoffCoord.lat, dropoffCoord.lng]);
            }
            bounds.push([dropoffCoord.lat, dropoffCoord.lng]);
        }

        // 3. Driver Marker
        if (pos) {
            if (!driverMarker.current) {
                const el = L.divIcon({
                    html: `<div style="font-size: 26px; transform: translate(-35%, -35%); filter: drop-shadow(0 0 6px var(--accent-glow));">🚚</div>`,
                    className: 'leaflet-emoji-icon',
                    iconSize: [28, 28]
                });
                driverMarker.current = L.marker([pos.lat, pos.lng], { icon: el }).addTo(mapInstance.current);
            } else {
                driverMarker.current.setLatLng([pos.lat, pos.lng]);
            }
            bounds.push([pos.lat, pos.lng]);
        }

        // 4. Zoom bounds
        if (bounds.length > 0) {
            mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
        }
    }, [pickupCoord, dropoffCoord, pos]);

    // Fetch and draw driving route using OSRM
    useEffect(() => {
        const updateRouteLine = async () => {
            if (!window.L || !mapInstance.current) return;
            const L = window.L;

            let origin = pos || pickupCoord;
            let dest = dropoffCoord;

            if (origin && dest) {
                const geom = await fetchRoute(origin, dest);
                if (geom) {
                    if (routeLayer.current) {
                        mapInstance.current.removeLayer(routeLayer.current);
                    }
                    routeLayer.current = L.geoJSON(geom, {
                        style: { color: 'var(--accent)', weight: 4, opacity: 0.8 }
                    }).addTo(mapInstance.current);
                }
            }
        };

        updateRouteLine();
    }, [pos, pickupCoord, dropoffCoord]);

    // Compute geofence distances
    const distToPickup  = haversineM(pos, pickupCoord);
    const distToDropoff = haversineM(pos, dropoffCoord);

    const nearPickup  = distToPickup  <= PICKUP_RADIUS_M;
    const nearDropoff = distToDropoff <= DROPOFF_RADIUS_M;

    // Tell parent whether "Mark Delivered" should be blocked
    useEffect(() => {
        if (!onGeofenceBlock || !pos || !dropoffCoord) return;
        onGeofenceBlock(!nearDropoff);
    }, [nearDropoff, pos, dropoffCoord, onGeofenceBlock]);

    if (!ride) return null;

    return (
        <div className="gps-tracker">
            <div className="gps-header">
                <span className={`gps-dot ${pos ? 'active' : 'inactive'}`} />
                <span className="gps-label">Live GPS{pos ? ' · Broadcasting' : ' · Acquiring…'}</span>
                {pushStatus === 'ok'    && <span className="gps-push ok">✓ Synced</span>}
                {pushStatus === 'error' && <span className="gps-push err">⚠ Sync failed</span>}
            </div>

            {gpsError && <div className="gps-error">{gpsError}</div>}

            {pos && (
                <div className="gps-stats">
                    <div>
                        <span className="stat-label">Lat</span>
                        <span className="stat-val">{pos.lat.toFixed(5)}</span>
                    </div>
                    <div>
                        <span className="stat-label">Lng</span>
                        <span className="stat-val">{pos.lng.toFixed(5)}</span>
                    </div>
                    {pos.speed != null && (
                        <div>
                            <span className="stat-label">Speed</span>
                            <span className="stat-val">{(pos.speed * 3.6).toFixed(0)} km/h</span>
                        </div>
                    )}
                    {pos.accuracy != null && (
                        <div>
                            <span className="stat-label">Accuracy</span>
                            <span className="stat-val">±{Math.round(pos.accuracy)} m</span>
                        </div>
                    )}
                </div>
            )}

            {/* Geofence indicators */}
            {pos && !geocoding && (
                <div className="gps-geofences">
                    {ride.status === 'accepted' && (
                        <div className={`geofence-badge ${nearPickup ? 'in-zone' : 'out-zone'}`}>
                            📦 Pickup: {nearPickup ? 'At location ✓' : fmtDist(distToPickup)}
                        </div>
                    )}

                    {ride.status === 'in-transit' && (
                        <div className={`geofence-badge ${nearDropoff ? 'in-zone' : 'out-zone'}`}>
                            🏁 Drop-off: {nearDropoff ? 'At location ✓' : fmtDist(distToDropoff)}
                        </div>
                    )}
                </div>
            )}

            <div className="gps-map-container">
                {geocoding && <div className="gps-map-loading">Loading locations…</div>}
                <div ref={mapRef} className="gps-leaflet-map" style={{ height: '240px', borderRadius: '12px', zIndex: 1 }} />
            </div>
        </div>
    );
}
