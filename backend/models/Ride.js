const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    customerId: { type: String },
    customerName: { type: String, default: 'Guest User' },
    customerPhone: { type: String, default: '' },
    customerGSTIN: { type: String, default: '' },
    driverId: { type: String, default: null },
    driverName: { type: String, default: null },
    driverVehicleNumber: { type: String, default: null },
    driverPhone: { type: String, default: '' },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, required: true },
    vehicleType: { type: String, default: 'tempo' },

    // --- fare breakdown (all amounts in INR, GST-ready) ---
    baseFare: { type: Number, default: 0 },       // flat starting charge
    distanceFare: { type: Number, default: 0 },   // per-km charge
    rainSurcharge: { type: Number, default: 0 },
    rushHourSurcharge: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },       // sum of the above, pre-tax
    taxRate: { type: Number, default: 18 },        // % — IGST for inter-state cargo movement
    taxAmount: { type: Number, default: 0 },
    price: { type: Number, default: 0 },            // grand total, tax included (used everywhere existing code expects "price")

    distance: { type: Number, default: 0 },
    isRaining: { type: Boolean, default: false },
    isRushHour: { type: Boolean, default: false },

    invoiceNumber: { type: String, default: null }, // assigned on delivery
    rating: { type: Number, default: null },
    status: {
        type: String,
        enum: ['searching', 'accepted', 'picked-up', 'in-transit', 'delivered', 'cancelled'],
        default: 'searching'
    }
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);
