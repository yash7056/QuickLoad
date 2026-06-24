import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import './CustomerLiveMap.css';

const API    = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API);

/** Geocode address via OpenStreetMap Nominatim */
async function geocodeAddress(address) {
    try {
        const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
        const res  = await fetch(url, { headers: { 'User-Agent': 'ssg-logistics-customer' } });
        const data = await res.json();
        if (data && data.length > 0) {
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
    } catch (_) {}
    return null;
}

/** Fetch ETA and route path using Open Source Routing Machine (OSRM) */
async function fetchRouteAndETA(origin, destination) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        const res  = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes?.[0]) {
            const route = data.routes[0];
            const distanceKm = (route.distance / 1000).toFixed(1);
            const durationMin = Math.round(route.duration / 60);
            
            let durationText = `${durationMin} mins`;
            if (durationMin >= 60) {
                const hrs = Math.floor(durationMin / 60);
                const mins = durationMin % 60;
                durationText = `${hrs} hr ${mins} mins`;
            }

            return {
                duration: durationText,
                distance: `${distanceKm} km`,
                geometry: route.geometry,
            };
        }
    } catch (_) {}
    return null;
}

const STATUS_LABEL = {
    searching:   'Finding a driver…',
    accepted:    'Driver is on the way to pick up your cargo',
    'picked-up': 'Cargo has been picked up',
    'in-transit':'Your cargo is on its way',
    delivered:   'Delivered ✓',
    cancelled:   'Cancelled',
};

export default function CustomerLiveMap({ ride }) {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const routeLayer = useRef(null);
    
    // Reference to markers
    const pickupMarker = useRef(null);
    const dropoffMarker = useRef(null);
    const driverMarker = useRef(null);

    const [driverPos, setDriverPos]     = useState(null);   // { lat, lng }
    const [pickupCoord, setPickupCoord]   = useState(null);
    const [dropoffCoord, setDropoffCoord] = useState(null);
    const [geocoding, setGeocoding]       = useState(true);
    const [eta, setEta]                   = useState(null);  // { duration, distance }

    // Clear markers/route on ride change
    useEffect(() => {
        if (!mapInstance.current) return;
        if (pickupMarker.current) { mapInstance.current.removeLayer(pickupMarker.current); pickupMarker.current = null; }
        if (dropoffMarker.current) { mapInstance.current.removeLayer(dropoffMarker.current); dropoffMarker.current = null; }
        if (driverMarker.current) { mapInstance.current.removeLayer(driverMarker.current); driverMarker.current = null; }
        if (routeLayer.current) { mapInstance.current.removeLayer(routeLayer.current); routeLayer.current = null; }
        setEta(null);
    }, [ride?._id]);

    // Seed location on load
    useEffect(() => {
        if (!ride) return;
        setDriverPos(null);
        fetch(`${API}/api/rides/${ride._id}/location`)
            .then((r) => r.json())
            .then((data) => {
                if (data.driverLocation?.lat != null) {
                    setDriverPos({ lat: data.driverLocation.lat, lng: data.driverLocation.lng });
                }
            })
            .catch(() => {});
    }, [ride?._id]);

    // Socket updates
    useEffect(() => {
        if (!ride) return;
        const onLocation = (data) => {
            if (String(data.rideId) !== String(ride._id)) return;
            setDriverPos({ lat: data.lat, lng: data.lng });
        };
        socket.on('driverLocation', onLocation);
        return () => socket.off('driverLocation', onLocation);
    }, [ride?._id]);

    // Geocode locations
    useEffect(() => {
        if (!ride) { setGeocoding(false); return; }
        setGeocoding(true);
        setPickupCoord(null);
        setDropoffCoord(null);
        Promise.all([
            geocodeAddress(ride.pickupLocation),
            geocodeAddress(ride.dropoffLocation),
        ]).then(([pu, dr]) => {
            setPickupCoord(pu);
            setDropoffCoord(dr);
            setGeocoding(false);
        });
    }, [ride?._id, ride?.pickupLocation, ride?.dropoffLocation]);

    // Init map
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

    // Update map overlays and route
    useEffect(() => {
        if (!window.L || !mapInstance.current) return;
        const L = window.L;

        const bounds = [];

        // 1. Render Pickup Marker
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

        // 2. Render Dropoff Marker
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

        // 3. Render Driver Marker
        if (driverPos) {
            if (!driverMarker.current) {
                const el = L.divIcon({
                    html: `<div style="font-size: 26px; transform: translate(-35%, -35%); filter: drop-shadow(0 0 6px var(--accent-glow));">🚚</div>`,
                    className: 'leaflet-emoji-icon',
                    iconSize: [28, 28]
                });
                driverMarker.current = L.marker([driverPos.lat, driverPos.lng], { icon: el }).addTo(mapInstance.current);
            } else {
                driverMarker.current.setLatLng([driverPos.lat, driverPos.lng]);
            }
            bounds.push([driverPos.lat, driverPos.lng]);
        }

        // 4. Fit map to elements
        if (bounds.length > 0) {
            mapInstance.current.fitBounds(bounds, { padding: [40, 40] });
        }
    }, [pickupCoord, dropoffCoord, driverPos]);

    // Fetch ETA & Route Line from OSRM
    useEffect(() => {
        const updateRoute = async () => {
            if (!window.L || !mapInstance.current) return;
            const L = window.L;

            let origin = driverPos || pickupCoord;
            let dest = dropoffCoord;

            if (origin && dest) {
                const routeData = await fetchRouteAndETA(origin, dest);
                if (routeData) {
                    setEta({ duration: routeData.duration, distance: routeData.distance });

                    // Draw route line
                    if (routeLayer.current) {
                        mapInstance.current.removeLayer(routeLayer.current);
                    }
                    routeLayer.current = L.geoJSON(routeData.geometry, {
                        style: { color: 'var(--accent)', weight: 4, opacity: 0.8 }
                    }).addTo(mapInstance.current);
                }
            }
        };

        updateRoute();
        const interval = setInterval(updateRoute, 30000);
        return () => clearInterval(interval);
    }, [driverPos, pickupCoord, dropoffCoord]);

    if (!ride) return null;

    const isActive  = !['delivered', 'cancelled', 'searching'].includes(ride.status);
    const statusMsg = STATUS_LABEL[ride.status] ?? ride.status;

    return (
        <div className="clm-wrap">
            {/* Status banner */}
            <div className={`clm-status ${ride.status}`}>
                <span className={`clm-dot ${isActive ? 'live' : ''}`} />
                {statusMsg}
            </div>

            {/* ETA chip */}
            {eta && isActive && (
                <div className="clm-eta">
                    🕐 ETA to drop-off: <strong>{eta.duration}</strong>
                    <span className="clm-eta-dist"> · {eta.distance} remaining</span>
                </div>
            )}

            {/* Driver position refresh indicator */}
            {driverPos && isActive && (
                <div className="clm-live-badge">
                    <span className="clm-live-dot" />
                    Driver location live
                    <span className="clm-coords">
                        {driverPos.lat.toFixed(4)}, {driverPos.lng.toFixed(4)}
                    </span>
                </div>
            )}

            {/* Map Container */}
            <div className="clm-map-container">
                {geocoding && <div className="clm-map-loading">Loading locations…</div>}
                <div ref={mapRef} className="clm-leaflet-map" style={{ height: '300px', borderRadius: '12px', zIndex: 1 }} />
            </div>

            {/* Legend */}
            <div className="clm-legend">
                <span>🟢 Pickup</span>
                <span>🚚 Driver</span>
                <span>🔴 Drop-off</span>
            </div>
        </div>
    );
}
