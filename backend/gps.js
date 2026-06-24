/**
 * gps.js  —  Live GPS tracking layer for SSG Logistics
 *
 * Mount this AFTER the main server.js setup by calling:
 *   attachGPS(app, io)
 *
 * It adds:
 *   PATCH  /api/rides/:id/location   (driver pushes coords)
 *   GET    /api/rides/:id/location   (anyone polls latest coords)
 *
 * And emits  driverLocation  via Socket.IO so the customer portal
 * receives real-time updates without polling.
 */

const mongoose = require('mongoose');
const Ride = mongoose.models.Ride || require('./models/Ride');

function attachGPS(app, io) {
    // ── Driver pushes its current GPS position ──────────────────────────────
    app.patch('/api/rides/:id/location', async (req, res) => {
        try {
            const { lat, lng, heading, speed } = req.body;

            if (lat == null || lng == null) {
                return res.status(400).json({ error: 'lat and lng are required.' });
            }

            const ride = await Ride.findByIdAndUpdate(
                req.params.id,
                {
                    $set: {
                        'driverLocation.lat': lat,
                        'driverLocation.lng': lng,
                        'driverLocation.heading': heading ?? null,
                        'driverLocation.speed': speed ?? null,
                        'driverLocation.updatedAt': new Date(),
                    },
                },
                { new: true }
            );

            if (!ride) return res.status(404).json({ error: 'Ride not found.' });

            // Broadcast to all connected clients so the customer map updates instantly
            io.emit('driverLocation', {
                rideId: ride._id,
                lat,
                lng,
                heading: heading ?? null,
                speed: speed ?? null,
                status: ride.status,
            });

            res.status(200).json({ ok: true });
        } catch (e) {
            console.error('❌ GPS update error:', e.message);
            res.status(500).json({ error: 'Location update failed.' });
        }
    });

    // ── Anyone can fetch the last known driver position ─────────────────────
    app.get('/api/rides/:id/location', async (req, res) => {
        try {
            const ride = await Ride.findById(req.params.id).select('driverLocation status pickupLocation dropoffLocation');
            if (!ride) return res.status(404).json({ error: 'Ride not found.' });
            res.status(200).json({
                driverLocation: ride.driverLocation ?? null,
                status: ride.status,
                pickupLocation: ride.pickupLocation,
                dropoffLocation: ride.dropoffLocation,
            });
        } catch (e) {
            res.status(500).json({ error: 'Fetch failed.' });
        }
    });

    console.log('📍 GPS tracking routes attached');
}

module.exports = { attachGPS };
