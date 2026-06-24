# 📍 Live GPS Tracking — SSG Logistics

This document covers only the **new GPS feature** added on top of the existing project.
All original files remain unchanged.

---

## What was added

| File | Where | Purpose |
|------|-------|---------|
| `backend/gps.js` | Backend | GPS REST endpoints + Socket.IO broadcast |
| `backend/server_gps.js` | Backend | New entry point (replaces `server.js` when using GPS) |
| `backend/models/RideWithGPS.js` | Backend | Extended Ride model with `driverLocation` field |
| `driver-portal/src/DriverGPSTracker.jsx` | Driver | GPS broadcast + map + geofence enforcement |
| `driver-portal/src/DriverGPSTracker.css` | Driver | Styles for above |
| `customer-portal/src/CustomerLiveMap.jsx` | Customer | Live map + ETA + real-time driver position |
| `customer-portal/src/CustomerLiveMap.css` | Customer | Styles for above |

---

## Setup

### 1. Google Maps API Key

You need a **single API key** with these APIs enabled (all free-tier friendly):

- Maps Embed API
- Geocoding API
- Distance Matrix API

Get one at: https://console.cloud.google.com/apis

> **Restrict the key** to your domains in production (Google Cloud Console → Credentials).

Add it to **both** front-end `.env` files:

```
# customer-portal/.env
VITE_GOOGLE_MAPS_KEY=AIza...

# driver-portal/.env
VITE_GOOGLE_MAPS_KEY=AIza...
```

### 2. Start the GPS-enabled backend

Instead of `node server.js`, run:

```bash
cd backend
node server_gps.js
```

This is a full replacement — same port (5000), same routes, same database,
plus the two new GPS endpoints.

### 3. Wire the components into App.jsx

The components ship with clear "HOW TO WIRE" comments at the bottom of each file.
Here is the quick summary:

#### driver-portal/src/App.jsx (3 changes, all additive)

```jsx
// 1. Add import at the top
import DriverGPSTracker from './DriverGPSTracker';

// 2. Add state
const [deliveryBlocked, setDeliveryBlocked] = useState(false);

// 3. Inside the active-trip motion.div, after the route-line div:
<DriverGPSTracker ride={activeRide} onGeofenceBlock={setDeliveryBlocked} />

// 4. Update the "Mark Delivered" button's disabled prop:
disabled={busyId === activeRide._id || (activeRide.status === 'in-transit' && deliveryBlocked)}
```

#### customer-portal/src/App.jsx (2 changes, all additive)

```jsx
// 1. Add import at the top
import CustomerLiveMap from './CustomerLiveMap';

// 2. Inside the Live Tracking card, after the <ol className="timeline">:
<CustomerLiveMap ride={activeRide} />
```

---

## Feature details

### Driver portal — DriverGPSTracker

- Uses **`navigator.geolocation.watchPosition`** for continuous high-accuracy GPS
- Pushes position to `PATCH /api/rides/:id/location` every **5 seconds**
- Shows live stats: latitude, longitude, speed (km/h), heading (°), accuracy (±m)
- **Google Maps embed** shows Pickup → Driver (waypoint) → Dropoff route
- **Geofence — Pickup zone (200 m radius):**
  Shows a green badge when the driver is close enough to confirm pickup.
  The badge turns amber with remaining distance when outside the zone.
- **Geofence — Drop-off zone (300 m radius):**
  The "Mark Delivered" button is **disabled** until the driver is within 300 m
  of the drop-off address, preventing premature delivery confirmation.

### Customer portal — CustomerLiveMap

- Seeds last known driver location on page load via `GET /api/rides/:id/location`
- Receives live position via **Socket.IO `driverLocation` event** (no polling)
- Shows **ETA** to drop-off using Google Distance Matrix, refreshed every 30 s
- Google Maps embed shows the full route with the driver's current position as a waypoint
- Degrades gracefully: shows a static pickup→dropoff route before the driver starts moving,
  and a plain status message if no API key is configured

### Backend — GPS endpoints

```
PATCH /api/rides/:id/location
Body: { lat, lng, heading?, speed? }
→ Updates driverLocation in MongoDB
→ Emits  driverLocation  via Socket.IO to all connected clients

GET /api/rides/:id/location
→ Returns last known { driverLocation, status, pickupLocation, dropoffLocation }
```

---

## Adjusting geofence radii

Open `driver-portal/src/DriverGPSTracker.jsx` and change:

```js
const PICKUP_RADIUS_M  = 200;   // metres from pickup to confirm pickup
const DROPOFF_RADIUS_M = 300;   // metres from dropoff to allow delivery
```

---

## Without a Google Maps key

Everything still works — the map panel shows a notice to add the key,
but GPS broadcasting, Socket.IO updates, and geofence enforcement
all function independently of Google Maps.
