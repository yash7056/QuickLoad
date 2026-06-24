/**
 * RideWithGPS.js  —  Extends the SSG Ride schema with GPS tracking fields.
 *
 * This is a NEW model file. The original models/Ride.js is NOT modified.
 * server_gps.js uses this model instead of the original Ride.
 *
 * It adds:
 *   driverLocation  { lat, lng, heading, speed, updatedAt }
 *
 * All original fields and behaviour are preserved verbatim.
 */

const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema(
    {
        customerId: { type: String },
        customerName: { type: String, default: 'Guest User' },
        customerPhone: { type: String, default: '' },
        customerGSTIN: { type: String, default: '' },
        driverId: { type: String, default: null },
        driverName: { type: String, default: null },
        driverVehicleNumber: { type: String, default: null },
        pickupLocation: { type: String, required: true },
        dropoffLocation: { type: String, required: true },
        vehicleType: { type: String, default: 'tempo' },

        // --- fare breakdown (all amounts in INR, GST-ready) ---
        baseFare: { type: Number, default: 0 },
        distanceFare: { type: Number, default: 0 },
        rainSurcharge: { type: Number, default: 0 },
        rushHourSurcharge: { type: Number, default: 0 },
        subtotal: { type: Number, default: 0 },
        taxRate: { type: Number, default: 18 },
        taxAmount: { type: Number, default: 0 },
        price: { type: Number, default: 0 },

        distance: { type: Number, default: 0 },
        isRaining: { type: Boolean, default: false },
        isRushHour: { type: Boolean, default: false },

        invoiceNumber: { type: String, default: null },
        rating: { type: Number, default: null },
        status: {
            type: String,
            enum: ['searching', 'accepted', 'picked-up', 'in-transit', 'delivered', 'cancelled'],
            default: 'searching',
        },

        // ── NEW: live driver GPS position ──────────────────────────────────
        driverLocation: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null },
            heading: { type: Number, default: null },  // degrees 0-360
            speed: { type: Number, default: null },    // m/s from browser geolocation
            updatedAt: { type: Date, default: null },
        },

        driverPhone: { type: String, default: '' },

        // ── NEW: customer location at booking ──────────────────────────────
        customerLocation: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null },
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Ride', rideSchema);
